package app.tasktower.home;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String ANDROID_BACK_HANDLER =
        "(function(){try{return !!(window.DwellioAndroidBack && window.DwellioAndroidBack.handle && window.DwellioAndroidBack.handle());}catch(error){return false;}})();";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DwellioNotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        applyLightSystemBars();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleNativeBackPressed();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        applyLightSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyLightSystemBars();
        }
    }

    private void applyLightSystemBars() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        window.setStatusBarColor(0xFFFBF9F4);
        window.setNavigationBarColor(0xFFFBF9F4);
        WindowCompat.setDecorFitsSystemWindows(window, true);

        int flags = decorView.getSystemUiVisibility();
        flags &= ~View.SYSTEM_UI_FLAG_FULLSCREEN;
        flags &= ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decorView.setSystemUiVisibility(flags);

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && window.getInsetsController() != null) {
            window.getInsetsController().setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            );
        }
    }

    private void handleNativeBackPressed() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) {
            moveTaskToBack(true);
            return;
        }

        webView.evaluateJavascript(ANDROID_BACK_HANDLER, handled -> {
            if (!"true".equals(handled)) {
                moveTaskToBack(true);
            }
        });
    }
}
