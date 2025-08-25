package com.lushprojects.circuitjs1.client.module;

import com.google.gwt.user.client.ui.MenuBar;
import com.google.gwt.user.client.ui.MenuItem;
import com.lushprojects.circuitjs1.client.CirSim;
import com.lushprojects.circuitjs1.client.MyCommand;
import com.google.gwt.user.client.Command;

public class MenuManager {
	private final CirSim sim;

	public MenuManager(CirSim sim) {
		this.sim = sim;
	}

	public void composeMainMenu(MenuBar mainMenuBar, int num) {
		sim.composeMainMenu(mainMenuBar, num);
	}

	public void composeSubcircuitMenu() {
		sim.composeSubcircuitMenuPublic();
	}

	public void composeSelectScopeMenu(MenuBar menuBar) {
		sim.composeSelectScopeMenu(menuBar);
	}

	public void doPopupMenu() {
		sim.doPopupMenuPublic();
	}

	public void menuPerformed(String menu, String item) {
		sim.menuPerformed(menu, item);
	}

	public MenuItem getClassCheckItem(String s, String t) {
		return sim.getClassCheckItemPublic(s, t);
	}

	public MenuItem iconMenuItem(String icon, String text, Command cmd) {
		return sim.iconMenuItemPublic(icon, text, cmd);
	}

	public MenuItem menuItemWithShortcut(String icon, String text, String shortcut, MyCommand cmd) {
		return sim.menuItemWithShortcutPublic(icon, text, shortcut, cmd);
	}
} 