package com.lushprojects.circuitjs1.client.module;

import com.lushprojects.circuitjs1.client.CirSim;
import com.google.gwt.user.client.ui.MenuBar;

public class ThemeManager {
	private final CirSim sim;

	public ThemeManager(CirSim sim) {
		this.sim = sim;
	}

	public boolean isWhiteBackground() {
		return sim.getPrintableCheckItem().getState();
	}

	public boolean toggleWhiteBackground() {
		boolean newState = !sim.getPrintableCheckItem().getState();
		sim.getPrintableCheckItem().setState(newState);
		sim.setOptionInStoragePublic("whiteBackground", newState);
		updateMenuBarTheme();
		sim.repaintPublic();
		return newState;
	}

	public void updateMenuBarTheme() {
		if (sim.getPrintableCheckItem() == null || sim.getMainMenuBar() == null)
			return;
		try {
			boolean isWhiteBg = sim.getPrintableCheckItem().getState();
			if (isWhiteBg) {
				MenuBar main = sim.getMainMenuBar();
				if (main != null) main.removeStyleName("gwt-MenuBar-dark");
				MenuBar file = sim.getFileMenuBar();
				if (file != null) file.removeStyleName("gwt-MenuBar-dark");
				MenuBar options = sim.getOptionsMenuBar();
				if (options != null) options.removeStyleName("gwt-MenuBar-dark");
				MenuBar elm = sim.getElmMenuBar();
				if (elm != null) elm.removeStyleName("gwt-MenuBar-dark");
				MenuBar[] subs = sim.getSubcircuitMenuBar();
				if (subs != null) {
					for (int i = 0; i < subs.length; i++) {
						if (subs[i] != null) subs[i].removeStyleName("gwt-MenuBar-dark");
					}
				}
				MenuBar select = sim.getSelectScopeMenuBar();
				if (select != null) select.removeStyleName("gwt-MenuBar-dark");
				// 新增：移除 Edit/Draw/Scopes 菜单的暗色样式
				MenuBar edit = sim.getEditMenuBar();
				if (edit != null) edit.removeStyleName("gwt-MenuBar-dark");
				MenuBar draw = sim.getDrawMenuBar();
				if (draw != null) draw.removeStyleName("gwt-MenuBar-dark");
				MenuBar scopes = sim.getScopesMenuBar();
				if (scopes != null) scopes.removeStyleName("gwt-MenuBar-dark");
			} else {
				MenuBar main = sim.getMainMenuBar();
				if (main != null) main.addStyleName("gwt-MenuBar-dark");
				MenuBar file = sim.getFileMenuBar();
				if (file != null) file.addStyleName("gwt-MenuBar-dark");
				MenuBar options = sim.getOptionsMenuBar();
				if (options != null) options.addStyleName("gwt-MenuBar-dark");
				MenuBar elm = sim.getElmMenuBar();
				if (elm != null) elm.addStyleName("gwt-MenuBar-dark");
				MenuBar[] subs = sim.getSubcircuitMenuBar();
				if (subs != null) {
					for (int i = 0; i < subs.length; i++) {
						if (subs[i] != null) subs[i].addStyleName("gwt-MenuBar-dark");
					}
				}
				MenuBar select = sim.getSelectScopeMenuBar();
				if (select != null) select.addStyleName("gwt-MenuBar-dark");
				// 新增：应用 Edit/Draw/Scopes 菜单的暗色样式
				MenuBar edit = sim.getEditMenuBar();
				if (edit != null) edit.addStyleName("gwt-MenuBar-dark");
				MenuBar draw = sim.getDrawMenuBar();
				if (draw != null) draw.addStyleName("gwt-MenuBar-dark");
				MenuBar scopes = sim.getScopesMenuBar();
				if (scopes != null) scopes.addStyleName("gwt-MenuBar-dark");
			}
		} catch (Exception e) {
			// ignore
		}
	}
} 