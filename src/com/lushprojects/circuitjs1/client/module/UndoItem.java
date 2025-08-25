package com.lushprojects.circuitjs1.client.module;

import com.lushprojects.circuitjs1.client.CirSim;

public class UndoItem {
	public String dump;
	public double scale, transform4, transform5;

	public UndoItem(CirSim sim) {
		this.dump = sim.dumpCircuitPublic();
		this.scale = sim.getTransformScale();
		this.transform4 = sim.getTransform4();
		this.transform5 = sim.getTransform5();
	}
} 