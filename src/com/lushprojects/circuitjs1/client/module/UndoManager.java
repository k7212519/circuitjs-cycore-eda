package com.lushprojects.circuitjs1.client.module;

import java.util.Vector;
import com.lushprojects.circuitjs1.client.CirSim;

public class UndoManager {
	private final CirSim sim;
	private Vector<UndoItem> undoStack;
	private Vector<UndoItem> redoStack;

	public UndoManager(CirSim sim) {
		this.sim = sim;
		this.undoStack = new Vector<UndoItem>();
		this.redoStack = new Vector<UndoItem>();
	}

	public void pushUndo() {
		redoStack.removeAllElements();
		String s = sim.dumpCircuitPublic();
		if (undoStack.size() > 0 && s.compareTo(undoStack.lastElement().dump) == 0)
			return;
		undoStack.add(new UndoItem(sim));
		enableUndoRedo();
		sim.setSavedFlagFalse();
	}

	public void doUndo() {
		if (undoStack.size() == 0)
			return;
		redoStack.add(new UndoItem(sim));
		UndoItem ui = undoStack.remove(undoStack.size() - 1);
		loadUndoItem(ui);
		enableUndoRedo();
	}

	public void doRedo() {
		if (redoStack.size() == 0)
			return;
		undoStack.add(new UndoItem(sim));
		UndoItem ui = redoStack.remove(redoStack.size() - 1);
		loadUndoItem(ui);
		enableUndoRedo();
	}

	public void doRecover() {
		pushUndo();
		sim.readCircuitPublic(sim.getRecovery());
		sim.allowSavePublic(false);
		sim.getRecoverItem().setEnabled(false);
	}

	public void loadUndoItem(UndoItem ui) {
		sim.readCircuitPublic(ui.dump, sim.getRCNoCenter());
		sim.setTransformScale(ui.scale);
		sim.setTransform4(ui.transform4);
		sim.setTransform5(ui.transform5);
	}

	public void enableUndoRedo() {
		sim.getRedoMenuItem().setEnabled(redoStack.size() > 0);
		sim.getUndoMenuItem().setEnabled(undoStack.size() > 0);
	}
} 