package com.lushprojects.circuitjs1.client.module;

import com.google.gwt.storage.client.Storage;
import com.lushprojects.circuitjs1.client.CirSim;

public class StorageManager {
	private final CirSim sim;

	public StorageManager(CirSim sim) {
		this.sim = sim;
	}

	public void writeClipboard(String clipboard) {
		Storage stor = Storage.getLocalStorageIfSupported();
		if (stor == null)
			return;
		stor.setItem("circuitClipboard", clipboard);
	}

	public String readClipboard() {
		Storage stor = Storage.getLocalStorageIfSupported();
		if (stor == null)
			return null;
		return stor.getItem("circuitClipboard");
	}

	public void writeRecovery(String dump) {
		Storage stor = Storage.getLocalStorageIfSupported();
		if (stor == null)
			return;
		stor.setItem("circuitRecovery", dump);
	}

	public String readRecovery() {
		Storage stor = Storage.getLocalStorageIfSupported();
		if (stor == null)
			return null;
		return stor.getItem("circuitRecovery");
	}
} 