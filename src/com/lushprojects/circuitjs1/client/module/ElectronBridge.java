package com.lushprojects.circuitjs1.client.module;

import com.lushprojects.circuitjs1.client.CirSim;

public class ElectronBridge {
	public static native void electronSaveAs(String dump) /*-{
		$wnd.showSaveDialog().then(function (file) {
			if (file.canceled)
				return;
			$wnd.saveFile(file, dump);
			@com.lushprojects.circuitjs1.client.CirSim::electronSaveAsCallback(Ljava/lang/String;)(file.filePath.toString());
		});
	}-*/;

	public static native void electronSave(String dump) /*-{
		$wnd.saveFile(null, dump);
		@com.lushprojects.circuitjs1.client.CirSim::electronSaveCallback()();
	}-*/;

	public static native void electronOpenFile() /*-{
		$wnd.openFile(function (text, name) {
			@com.lushprojects.circuitjs1.client.CirSim::electronOpenFileCallback(Ljava/lang/String;Ljava/lang/String;)(text, name);
		});
	}-*/;

	public static native void toggleDevTools() /*-{
		$wnd.toggleDevTools();
	}-*/;

	public static native boolean isElectron() /*-{
		return ($wnd.openFile != undefined);
	}-*/;

	public static native String getElectronStartCircuitText() /*-{
		return $wnd.startCircuitText;
	}-*/;
} 