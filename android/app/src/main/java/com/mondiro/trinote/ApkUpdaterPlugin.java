package com.mondiro.trinote;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Tải APK bản mới từ GitHub Releases rồi mở trình cài đặt của Android. */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("Thiếu url"); return; }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                dir.mkdirs();
                File apk = new File(dir, "update.apk");
                HttpURLConnection conn = open(url);
                long total = conn.getContentLengthLong();
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0; int n; int lastPct = -1;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != lastPct) { lastPct = pct; JSObject p = new JSObject(); p.put("percent", pct); notifyListeners("progress", p); }
                        }
                    }
                }
                conn.disconnect();
                getActivity().runOnUiThread(() -> install(apk, call));
            } catch (Exception e) {
                call.reject("Tải bản cập nhật lỗi: " + e.getMessage());
            }
        }).start();
    }

    private HttpURLConnection open(String url) throws Exception {
        // GitHub chuyển hướng sang máy chủ khác, tự đi theo tối đa 5 lần
        for (int i = 0; i < 5; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept", "application/octet-stream");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { url = c.getHeaderField("Location"); c.disconnect(); continue; }
            return c;
        }
        throw new Exception("Quá nhiều chuyển hướng");
    }

    private void install(File apk, PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(s);
            call.reject("NEED_PERMISSION");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
