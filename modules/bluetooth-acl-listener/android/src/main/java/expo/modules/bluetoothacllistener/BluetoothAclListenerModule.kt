package expo.modules.bluetoothacllistener

import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Listens for system-wide Bluetooth Classic ACL connect/disconnect broadcasts.
 *
 * These fire for ANY already-paired device establishing or losing its baseband
 * link (e.g. a phone auto-connecting to a car head unit) — unlike a socket the
 * app opens itself, which only reports the app's own connections.
 */
class BluetoothAclListenerModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("BluetoothAclListener")

    Events("onDeviceConnected", "onDeviceDisconnected")

    OnCreate {
      registerReceiver()
    }

    OnDestroy {
      unregisterReceiver()
    }

    Function("isAvailable") {
      true
    }
  }

  private fun registerReceiver() {
    val context = appContext.reactContext ?: return
    if (receiver != null) {
      return
    }

    val moduleReceiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context, intent: Intent) {
        @Suppress("DEPRECATION")
        val device: BluetoothDevice = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE) ?: return
        val address = device.address ?: return
        val name = try {
          device.name
        } catch (error: SecurityException) {
          null
        }

        val payload = mapOf("address" to address, "name" to (name ?: ""))

        when (intent.action) {
          BluetoothDevice.ACTION_ACL_CONNECTED -> sendEvent("onDeviceConnected", payload)
          BluetoothDevice.ACTION_ACL_DISCONNECTED -> sendEvent("onDeviceDisconnected", payload)
        }
      }
    }

    val filter = IntentFilter().apply {
      addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
      addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.registerReceiver(context, moduleReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(moduleReceiver, filter)
    }

    receiver = moduleReceiver
  }

  private fun unregisterReceiver() {
    val context = appContext.reactContext ?: return
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (error: IllegalArgumentException) {
        // Receiver was already unregistered (e.g. context torn down first) — safe to ignore.
      }
      receiver = null
    }
  }
}
