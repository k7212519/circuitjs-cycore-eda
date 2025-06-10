/*    
    Copyright (C) Paul Falstad and Iain Sharp
    
    This file is part of CircuitJS1.

    CircuitJS1 is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    CircuitJS1 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with CircuitJS1.  If not, see <http://www.gnu.org/licenses/>.
*/

package com.lushprojects.circuitjs1.client;

/**
 * 芯片元素的抽象基类
 * 这个类为电路模拟中的集成芯片提供基础实现
 * 它处理芯片的绘制、引脚布局、电压和电流的计算等
 * 所有具体的芯片类型（如逻辑门、触发器等）都继承自此类
 */
abstract class ChipElm extends CircuitElm {
	// 芯片大小和间距参数
	int csize, // 芯片大小单位
	    cspc,  // 芯片间距
	    cspc2; // 芯片间距的两倍
	int bits; // 位数，对于需要位数的芯片（如计数器、移位寄存器等）
	double highVoltage; // 高电平电压值，默认为5V
	
	// 芯片的标志位常量
	static final int FLAG_SMALL = 1;            // 小型芯片标志
	static final int FLAG_FLIP_X = 1<<10;       // X轴翻转标志
	static final int FLAG_FLIP_Y = 1<<11;       // Y轴翻转标志
	static final int FLAG_FLIP_XY = 1<<12;      // XY轴互换标志
	static final int FLAG_CUSTOM_VOLTAGE = 1<<13; // 自定义电压标志
	/**
	 * 芯片元素的基本构造函数
	 * @param xx 芯片的x坐标
	 * @param yy 芯片的y坐标
	 */
	public ChipElm(int xx, int yy) {
	    super(xx, yy);
	    if (needsBits())
		bits = defaultBitCount(); // 如果芯片需要位数，设置默认位数
	    highVoltage = 5; // 默认高电平为5V
	    noDiagonal = true; // 禁止对角线连接
	    setupPins(); // 设置芯片引脚
	    setSize(sim.smallGridCheckItem.getState() ? 1 : 2); // 根据网格大小设置芯片大小
	}
	/**
	 * 从保存状态恢复芯片元素的构造函数
	 * @param xa 起点x坐标
	 * @param ya 起点y坐标
	 * @param xb 终点x坐标
	 * @param yb 终点y坐标
	 * @param f 标志位
	 * @param st 包含芯片状态的字符串标记
	 */
	public ChipElm(int xa, int ya, int xb, int yb, int f,
		       StringTokenizer st) {
	    super(xa, ya, xb, yb, f);
	    if (needsBits())
	    	if (st.hasMoreTokens())
	    		bits = new Integer(st.nextToken()).intValue(); // 从标记中读取位数
	    	else
	    		bits = defaultBitCount(); // 使用默认位数
	    highVoltage = (hasCustomVoltage()) ? Double.parseDouble(st.nextToken()) : 5; // 读取自定义电压或使用默认值
	    noDiagonal = true; // 禁止对角线连接
	    setupPins(); // 设置芯片引脚
	    setSize((f & FLAG_SMALL) != 0 ? 1 : 2); // 根据标志设置芯片大小
	    int i;
	    for (i = 0; i != getPostCount(); i++) { // 遍历所有引脚
		if (pins == null)
		    volts[i] = new Double(st.nextToken()).doubleValue(); // 读取电压值
		else if (pins[i].state) {
		    volts[i] = new Double(st.nextToken()).doubleValue(); // 读取有状态引脚的电压值
		    pins[i].value = volts[i] > getThreshold(); // 根据阈值确定逻辑值
		}
	    }
	}
	/**
	 * 判断芯片是否需要位数设置
	 * @return 默认返回false，子类可重写此方法
	 */
	boolean needsBits() { return false; }
	
	/**
	 * 判断芯片是否使用自定义电压
	 * @return 如果设置了自定义电压标志，则返回true
	 */
	boolean hasCustomVoltage() { return (flags & FLAG_CUSTOM_VOLTAGE) != 0; }
	
	/**
	 * 判断是否为数字芯片
	 * @return 默认返回true，对于模拟芯片，子类应重写为false
	 */
	boolean isDigitalChip() { return true; }
	
	/**
	 * 获取逻辑阈值电压
	 * @return 返回高电平电压的一半作为阈值
	 */
	double getThreshold() { return highVoltage/2; }
	
	/**
	 * 获取默认位数
	 * @return 默认返回4位，子类可重写此方法
	 */
	int defaultBitCount() { return 4; }
	
	/**
	 * 设置芯片大小
	 * @param s 大小参数：1表示小型，2表示标准大小
	 */
	void setSize(int s) {
	    csize = s; // 设置大小单位
	    cspc = 8*s; // 计算间距（8倍于大小单位）
	    cspc2 = cspc*2; // 计算两倍间距
	    flags &= ~FLAG_SMALL; // 清除小型标志
	    flags |= (s == 1) ? FLAG_SMALL : 0; // 如果s为1，设置小型标志
	}
	/**
	 * 设置芯片引脚布局
	 * 这是一个抽象方法，必须由子类实现以定义特定芯片的引脚布局
	 */
	abstract void setupPins();
	/**
	 * 绘制芯片
	 * @param g 图形上下文
	 */
	void draw(Graphics g) {
	    drawChip(g); // 调用芯片绘制方法
	}
	void drawChip(Graphics g) {
	    int i;
	    g.save();
	    Font f = new Font("normal", 0, 10*csize);
//	    FontMetrics fm = g.getFontMetrics();
	    boolean hasVertical = false;
	    // check if there are any vertical pins.  if not, we can make the labels wider
	    for (i = 0; i != getPostCount(); i++)
		if (pins[i].side == SIDE_N || pins[i].side == SIDE_S) {
		    hasVertical = true;
		    break;
		}
	    for (i = 0; i != getPostCount(); i++) {
		g.setFont(f);
		Pin p = pins[i];
		setVoltageColor(g, volts[i]);
		Point a = p.post;
		Point b = p.stub;
		drawThickLine(g, a, b);
		p.curcount = updateDotCount(p.current, p.curcount);
		drawDots(g, b, a, p.curcount);
		if (p.bubble) {
		    g.setColor(sim.getBackgroundColor());
		    drawThickCircle(g, p.bubbleX, p.bubbleY, 1);
		    g.setColor(lightGrayColor);
		    drawThickCircle(g, p.bubbleX, p.bubbleY, 3);
		}
		if (p.clockPointsX != null) {
		    g.setColor(lightGrayColor);
		    g.drawPolyline(p.clockPointsX, p.clockPointsY, 3);
		}
		g.setColor(p.selected ? selectColor : whiteColor);
		int fsz = 10*csize;
		double availSpace = cspc*2-8;
		// allow a little more space if the chip is wide and there are no vertical pins
		// (we could still do this if vertical pins are present but then we would have to do
		// more work to avoid overlaps)
		if (!hasVertical && sizeX > 2)
		    availSpace = cspc*2.5+cspc*(sizeX-3);
		while (true) {
		    int sw=(int)g.context.measureText(p.text).getWidth();
		    // scale font down if it's too big
		    if (sw > availSpace) {
			fsz -= 1;
			Font f2 = new Font("normal", 0, fsz);
			g.setFont(f2);
			continue;
		    }
		    int asc=(int)g.currentFontSize;
		    int tx;
		    // put text closer to edge if it's on left or right.
		    if (p.side == flippedXSide(SIDE_W))
			tx = p.textloc.x-(cspc-5);
		    else if (p.side == flippedXSide(SIDE_E))
			tx = p.textloc.x+(cspc-5)-sw;
		    else
			tx = p.textloc.x-sw/2;
		    g.drawString(p.text, tx, p.textloc.y+asc/3);
		    if (p.lineOver) {
			int ya = p.textloc.y-asc+asc/3;
			g.drawLine(tx, ya, tx+sw, ya);
		    }
		    break;
		}
	    }
	    
	    drawLabel(g, labelX, labelY);
	    g.setColor(needsHighlight() ? selectColor : lightGrayColor);
	    drawThickPolygon(g, rectPointsX, rectPointsY, 4);
	    drawPosts(g);
	    g.restore();
	}
	int rectPointsX[], rectPointsY[];
	Pin pins[];
	int sizeX, sizeY, flippedSizeX, flippedSizeY;
	boolean lastClock;
	void drag(int xx, int yy) {
	    yy = sim.snapGrid(yy);
	    if (xx < x) {
		xx = x; yy = y;
	    } else {
		y = y2 = yy;
		x2 = sim.snapGrid(xx);
	    }
	    setPoints();
	}
	
	void drawLabel(Graphics g, int x, int y) {}
	int labelX, labelY;
		
	void setPoints() {
	    if (x2-x > sizeX*cspc2 && this == sim.dragElm)
		setSize(2);
	    int x0 = x+cspc2; int y0 = y;
	    int xr = x0-cspc;
	    int yr = y0-cspc;
	    flippedSizeX = sizeX;
	    flippedSizeY = sizeY;
	    if (isFlippedXY()) {
		flippedSizeX = sizeY;
		flippedSizeY = sizeX;
	    }
	    int xs = flippedSizeX*cspc2;
	    int ys = flippedSizeY*cspc2;
	    int i;
	    for (i = 0; i != getPostCount(); i++) {
		Pin p = pins[i];
		p.side = p.side0;
		if ((flags & FLAG_FLIP_XY) != 0)
		    p.side = sideFlipXY[p.side];
		switch (p.side) {
		case SIDE_N: p.setPoint(x0, y0, 1, 0, 0, -1, 0, 0); break;
		case SIDE_S: p.setPoint(x0, y0, 1, 0, 0,  1, 0, ys-cspc2);break;
		case SIDE_W: p.setPoint(x0, y0, 0, 1, -1, 0, 0, 0); break;
		case SIDE_E: p.setPoint(x0, y0, 0, 1,  1, 0, xs-cspc2, 0);break;
		}
	    }
	    rectPointsX = new int[] { xr, xr+xs, xr+xs, xr };
	    rectPointsY = new int[] { yr, yr, yr+ys, yr+ys };
	    setBbox(xr, yr, rectPointsX[2], rectPointsY[2]);
	    labelX = xr+xs/2;
	    labelY = yr+ys/2;
	}
	
	// see if we can move pin to position xp, yp, and return the new position
	boolean getPinPos(int xp, int yp, int pin, int pos[]) {
	    int x0 = x+cspc2; int y0 = y;
	    int xr = x0-cspc;
	    int yr = y0-cspc;
	    double xd = (xp-xr)/(double)cspc2 - .5;
	    double yd = (yp-yr)/(double)cspc2 - .5;
	    if (xd < .25 && yd > 0 && yd < sizeY-1) {
		pos[0] = (int) Math.max(Math.round(yd), 0);
		pos[1] = SIDE_W;
	    } else if (xd > sizeX-.75) {
		pos[0] = (int) Math.min(Math.round(yd), sizeY-1);
		pos[1] = SIDE_E;
	    } else if (yd < .25) {
		pos[0] = (int) Math.max(Math.round(xd), 0);
		pos[1] = SIDE_N;
	    } else if (yd > sizeY-.75) {
		pos[0] = (int) Math.min(Math.round(xd), sizeX-1);
		pos[1] = SIDE_S;
	    } else
		return false;
	    
	    if (pos[0] < 0)
		return false;
	    if ((pos[1] == SIDE_N || pos[1] == SIDE_S) && pos[0] >= sizeX)
		return false;
	    if ((pos[1] == SIDE_W || pos[1] == SIDE_E) && pos[0] >= sizeY)
		return false;
	    return true;
	}
	
	int getOverlappingPin(int p1, int p2, int pin) {
	    for (int i = 0; i != getPostCount(); i++) {
		if (pin == i)
		    continue;
		if (pins[i].overlaps(p1, p2))
		    return i;
	    }
	    return -1;
	}
	
	Point getPost(int n) {
	    return pins[n].post;
	}
	abstract int getVoltageSourceCount(); // output count
	void setVoltageSource(int j, int vs) {
	    int i;
	    for (i = 0; i != getPostCount(); i++) {
		Pin p = pins[i];
		if (p.output && j-- == 0) {
		    p.voltSource = vs;
		    return;
		}
	    }
	    System.out.println("setVoltageSource failed for " + this);
	}
	/**
	 * 在电路中添加芯片的电压源
	 * 这个方法为芯片的每个输出引脚在模拟矩阵中添加电压源
	 */
	void stamp() {
	    int i;
	    int vsc = 0; // 电压源计数器
	    for (i = 0; i != getPostCount(); i++) { // 遍历所有引脚
		Pin p = pins[i];
		if (p.output) { // 如果是输出引脚
		    sim.stampVoltageSource(0, nodes[i], p.voltSource); // 在矩阵中添加电压源
		    vsc++; // 电压源计数增加
		}
	    }
	    // 检查电压源数量是否与输出引脚数量匹配
	    if (vsc != getVoltageSourceCount())
		CirSim.console("voltage source count does not match number of outputs");
	}
	/**
	 * 执行芯片逻辑
	 * 空实现，由子类重写以实现特定芯片的逻辑功能
	 */
	void execute() {}
	/**
	 * 执行一个模拟步骤
	 * 读取输入引脚状态，执行芯片逻辑，更新输出引脚电压
	 */
	void doStep() {
	    int i;
	    // 读取所有输入引脚的状态
	    for (i = 0; i != getPostCount(); i++) {
		Pin p = pins[i];
		if (!p.output) // 如果是输入引脚
		    p.value = volts[i] > getThreshold(); // 根据电压和阈值确定逻辑值
	    }
	    execute(); // 执行芯片特定逻辑
	    // 更新所有输出引脚的电压
	    for (i = 0; i != getPostCount(); i++) {
		Pin p = pins[i];
		if (p.output) // 如果是输出引脚
		    sim.updateVoltageSource(0, nodes[i], p.voltSource,
					p.value ? highVoltage : 0); // 根据逻辑值设置输出电压
	    }
	}
	/**
	 * 重置芯片状态
	 * 将所有引脚的值、电流计数和电压重置为初始状态
	 */
	void reset() {
	    int i;
	    for (i = 0; i != getPostCount(); i++) { // 遍历所有引脚
		pins[i].value = false; // 重置逻辑值为false
		pins[i].curcount = 0; // 重置电流计数
		volts[i] = 0; // 重置电压为0
	    }
	    lastClock = false; // 重置时钟状态
	}
	
	String dump() {
	    if (highVoltage == 5)
		flags &= ~FLAG_CUSTOM_VOLTAGE;
	    else
		flags |= FLAG_CUSTOM_VOLTAGE;
	    
	    String s = super.dump();
	    if (needsBits())
		s += " " + bits;
	    if (hasCustomVoltage())
		s += " " + highVoltage;
	    int i;
	    for (i = 0; i != getPostCount(); i++) {
		if (pins[i].state)
		    s += " " + volts[i];
	    }
	    return s;
	}
	
	void writeOutput(int n, boolean value) {
	    if (!pins[n].output)
		CirSim.console("pin " + n + " is not an output!");
	    pins[n].value = value;
	}
	
	void getInfo(String arr[]) {
	    arr[0] = getChipName();
	    int i, a = 1;
	    for (i = 0; i != getPostCount(); i++) {
		Pin p = pins[i];
		if (arr[a] != null)
		    arr[a] += "; ";
		else
		    arr[a] = "";
		String t = p.text;
		if (p.lineOver)
		    t += '\'';
		if (p.clock)
		    t = "Clk";
		arr[a] += t + " = " + getVoltageText(volts[i]);
		if (i % 2 == 1)
		    a++;
	    }
	}
	void setCurrent(int x, double c) {
	    int i;
	    for (i = 0; i != getPostCount(); i++)
		if (pins[i].output && pins[i].voltSource == x)
		    pins[i].current = c;
	}
	String getChipName() { return "chip"; }
	boolean getConnection(int n1, int n2) { return false; }
	boolean hasGroundConnection(int n1) {
	    return pins[n1].output;
	}
	
	double getCurrentIntoNode(int n) {
	    return pins[n].current;
	}
	
	boolean isFlippedX () { return hasFlag(FLAG_FLIP_X ); }
	boolean isFlippedY () { return hasFlag(FLAG_FLIP_Y ); }
	boolean isFlippedXY() { return hasFlag(FLAG_FLIP_XY); }
	
	public EditInfo getEditInfo(int n) {
	    if (!isDigitalChip())
		return getChipEditInfo(n);
	    
	    if (n == 0)
		return new EditInfo("High Logic Voltage", highVoltage);
	    
	    return getChipEditInfo(n-1);
	}
	public void setEditValue(int n, EditInfo ei) {
	    if (!isDigitalChip()) {
		setChipEditValue(n, ei);
		return;
	    }
	    
	    if (n == 0)
		highVoltage = ei.value;
	    
	    if (n >= 1)
		setChipEditValue(n-1, ei);
	}
	
	public EditInfo getChipEditInfo(int n) { return null; }
	public void setChipEditValue(int n, EditInfo ei) { }
	
	static String writeBits(boolean[] data) {
		StringBuilder sb = new StringBuilder();
		int integer = 0;
		int bitIndex = 0;
		for (int i = 0; i < data.length; i++) {
			if (bitIndex >= Integer.SIZE) {
				//Flush completed integer
				sb.append(' ');
				sb.append(integer);
				integer = 0;
				bitIndex = 0;
			}
			if (data[i])
				integer |= 1 << bitIndex;
			bitIndex++;
		}
		if (bitIndex > 0) {
			sb.append(' ');
			sb.append(integer);
		}
		return sb.toString();
	}
	static void readBits(StringTokenizer st, boolean[] output) {
		int integer = 0;
		int bitIndex = Integer.MAX_VALUE;
		for (int i = 0; i < output.length; i++) {
			if (bitIndex >= Integer.SIZE)
				if (st.hasMoreTokens()) {
					integer = Integer.parseInt(st.nextToken()); //Load next integer
					bitIndex = 0;
				} else
					break; //Data is absent
			
			output[i] = (integer & (1 << bitIndex)) != 0;
			bitIndex++;
		}
	}

	static final int SIDE_N = 0;
	static final int SIDE_S = 1;
	static final int SIDE_W = 2;
	static final int SIDE_E = 3;
	
	static final int sideFlipXY[] = { SIDE_W, SIDE_E, SIDE_N, SIDE_S };

	int flippedXSide(int s) {
	    if (!isFlippedX())
		return s;
	    if (s == SIDE_W)
		return SIDE_E;
	    if (s == SIDE_E)
		return SIDE_W;
	    return s;
	}
	
	void flipX(int center2, int count) {
	    flags ^= FLAG_FLIP_X;
	    if (count != 1) {
		int xs = (flippedSizeX+1)*cspc2;
		x  = center2-x - xs;
		x2 = center2-x2;
	    }
	    setPoints();
	}

	void flipY(int center2, int count) {
	    flags ^= FLAG_FLIP_Y;
	    if (count != 1) {
		int ys = (flippedSizeY-1)*cspc2;
		y  = center2-y - ys;
		y2 = center2-y2;
	    }
	    setPoints();
	}

	void flipXY(int xmy, int count) {
	    flags ^= FLAG_FLIP_XY;

	    // FLAG_FLIP_XY is applied first.  So need to swap X and Y
	    if (isFlippedX() != isFlippedY())
		flags ^= FLAG_FLIP_X|FLAG_FLIP_Y;

	    if (count != 1) {
		x += cspc2;
		super.flipXY(xmy, count);
		x -= cspc2;
	    }
	    setPoints();
	}

	class Pin {
	    Pin(int p, int s, String t) {
		pos = p; side0 = side = s; text = t;
	    }
	    Point post, stub;
	    Point textloc;
	    int pos, side, side0, voltSource, bubbleX, bubbleY;
	    String text;
	    boolean lineOver, bubble, clock, output, value, state, selected;
	    double curcount, current;
            int clockPointsX[], clockPointsY[];
	    void setPoint(int px, int py, int dx, int dy, int dax, int day, int sx, int sy) {
		if (isFlippedX()) {
		    dx = -dx;
		    dax = -dax;
		    px += cspc2*(flippedSizeX-1);
		    sx = -sx;
		}
		if (isFlippedY()) {
		    dy = -dy;
		    day = -day;
		    py += cspc2*(flippedSizeY-1);
		    sy = -sy;
		}
		int xa = px+cspc2*dx*pos+sx;
		int ya = py+cspc2*dy*pos+sy;
		post    = new Point(xa+dax*cspc2, ya+day*cspc2);
		stub    = new Point(xa+dax*cspc , ya+day*cspc );
		textloc = new Point(xa       , ya       );
		if (bubble) {
		    bubbleX = xa+dax*10*csize;
		    bubbleY = ya+day*10*csize;
		}
		if (clock) {
		    if (clockPointsX == null) {
			clockPointsX = new int[3];
			clockPointsY = new int[3];
		    }
		    clockPointsX[0] = xa+dax*cspc-dx*cspc/2;
		    clockPointsY[0] = ya+day*cspc-dy*cspc/2;
		    clockPointsX[1] = xa;
		    clockPointsY[1] = ya;
		    clockPointsX[2] = xa+dax*cspc+dx*cspc/2;
		    clockPointsY[2] = ya+day*cspc+dy*cspc/2;
		    if (text.length() > 0) {
			// See for example http://127.0.0.1:8000/circuitjs.html?ctz=CQAgjCAMB0l3BWcMBMcUHYMGZIA4UA2ATmIxAUgpABZsKBTAWjDACgAncDQkPKlDSr8oySGzTkwPPlTAo8s2iADCAGQDSALgCSAOQBqWle0khBwgUJDYUy9dv1GVKCZHIXwNGubyKw3vaauobG2G5SMgE+0rxgxHY+DiHONJzcvCKxXj5y8OnZ0ebWRXlw6Z5FniJl4kA
			clockPointsX[1] += dax*cspc/2;
			clockPointsY[1] += day*cspc/2;
			textloc.x -= dax*cspc/2;
			textloc.y -= day*cspc/4;
		    }
		}
		else {
		    clockPointsX = null;
		    clockPointsY = null;
		}
	    }

	    // convert position, side to a grid position (0=top left) so we can detect overlaps
	    int toGrid(int p, int s) {
		if (s == SIDE_N)
		    return p;
		if (s == SIDE_S)
		    return p+sizeX*(sizeY-1);
		if (s == SIDE_W)
		    return p*sizeX;
		if (s == SIDE_E)
		    return p*sizeX+sizeX-1;
		return -1;
	    }
	    
	    boolean overlaps(int p, int s) {
		int g = toGrid(p, s);
		if (g == -1)
		    return true;
		return toGrid(pos, side) == g;
	    }
	    
	    void fixName() {
		if (text.startsWith("/")) {
		    text = text.substring(1);
		    lineOver = true;
		}
		else if (text.startsWith("#")) {
		    text = text.substring(1);
		    bubble = true;
		}

		String result = text.replaceAll("CLK:", "");
		if (result.length() != text.length()) {
		    clock = true;
		    text = result;
		}
		result = text.replaceAll("INV:", "");
		if (result.length() != text.length()) {
		    bubble = true;
		    text = result;
		}

		if (text.compareToIgnoreCase("clk") == 0) {
		    text = "";
		    clock = true;
		}
	    }
	    

	}
    }

