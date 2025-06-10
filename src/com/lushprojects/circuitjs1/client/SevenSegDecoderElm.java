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
     * 七段数码管译码器芯片
     * 将4位二进制输入(I0-I3)译码为控制七段数码管显示的7位输出信号(a-g)
     * 可用于驱动七段数码管显示数字0-9和字符A-F
     */
    class SevenSegDecoderElm extends ChipElm {

	/**
	 * 译码表：定义16个可能的输入值(0-15)对应的七段显示模式
	 * 每行代表一个数字/字符的显示模式，七个布尔值分别对应a,b,c,d,e,f,g段
	 * true表示该段点亮，false表示该段不亮
	 */
	private static final boolean[][] symbols={
		{true,true,true,true,true,true,false},//0
		{false,true,true,false,false,false,false},//1
		{true,true,false,true,true,false,true},//2
		{true,true,true,true,false,false,true},//3
		{false,true,true,false,false,true,true},//4
		{true,false,true,true,false,true,true},//5
		{true,false,true,true,true,true,true},//6
		{true,true,true,false,false,false,false},//7
		{true,true,true,true,true,true,true},//8
		{true,true,true,false,false,true,true},//9
		{true,true,true,false,true,true,true},//A
		{false,false,true,true,true,true,true},//B
		{true,false,false,true,true,true,false},//C
		{false,true,true,true,true,false,true},//D
		{true,false,false,true,true,true,true},//E
		{true,false,false,false,true,true,true},//F
	};
	// 芯片功能标志位
	static final int FLAG_ENABLE = (1<<1); // 使能空白输入引脚(BI)标志
	static final int FLAG_BLANK_F = (1<<2); // 在输入为F(1111)时关闭显示的标志

	/**
	 * 创建新的七段译码器芯片的构造函数
	 * @param xx 芯片的x坐标
	 * @param yy 芯片的y坐标
	 */
	public SevenSegDecoderElm(int xx, int yy) { super(xx, yy); }
	/**
	 * 从保存状态恢复七段译码器芯片的构造函数
	 * @param xa 起点x坐标
	 * @param ya 起点y坐标
	 * @param xb 终点x坐标
	 * @param yb 终点y坐标
	 * @param f 标志位
	 * @param st 包含芯片状态的字符串标记
	 */
	public SevenSegDecoderElm(int xa, int ya, int xb, int yb, int f,
			    StringTokenizer st) {
	    super(xa, ya, xb, yb, f, st);
	}
	/**
	 * 获取芯片名称
	 * @return 芯片的显示名称
	 */
	String getChipName() { return "7-Segment Decoder"; }

	/**
	 * 设置芯片引脚布局
	 * 定义输入引脚(I0-I3)和输出引脚(a-g)的位置和功能
	 */
	void setupPins() {
	    sizeX = 3; // 芯片宽度为3个单位
	    sizeY = 7; // 芯片高度为7个单位
	    pins = new Pin[getPostCount()]; // 创建引脚数组

	    // 设置4位二进制输入引脚，位于芯片左侧
	    pins[7] = new Pin(0, SIDE_W, "I3"); // 最高位
	    pins[8] = new Pin(1, SIDE_W, "I2");
	    pins[9] = new Pin(2, SIDE_W, "I1");
	    pins[10] = new Pin(3, SIDE_W, "I0"); // 最低位
	
	    // 设置7个输出引脚，对应七段数码管的a-g段，位于芯片右侧
	    pins[0] = new Pin(0, SIDE_E, "a"); // a段输出
	    pins[0].output=true; // 标记为输出引脚
	    pins[1] = new Pin(1, SIDE_E, "b"); // b段输出
	    pins[1].output=true;
	    pins[2] = new Pin(2, SIDE_E, "c"); // c段输出
	    pins[2].output=true;
	    pins[3] = new Pin(3, SIDE_E, "d"); // d段输出
	    pins[3].output=true;
	    pins[4] = new Pin(4, SIDE_E, "e"); // e段输出
	    pins[4].output=true;
	    pins[5] = new Pin(5, SIDE_E, "f"); // f段输出
	    pins[5].output=true;
	    pins[6] = new Pin(6, SIDE_E, "g"); // g段输出
	    pins[6].output=true;
	    
	    // 如果启用了空白控制功能，添加空白输入引脚(BI)
	    if (hasBlank()) {
		pins[11] = new Pin(4, SIDE_W, "BI"); // 空白输入引脚
		pins[11].bubble = true; // 添加反相气泡，表示低电平有效
	    }
	    allocNodes();
	}

	/**
	 * 判断是否启用了空白控制引脚
	 * @return 如果启用了空白控制引脚则返回true
	 */
	boolean hasBlank() { return (flags & FLAG_ENABLE) != 0; }
	
	/**
	 * 判断是否在输入为F(1111)时关闭显示
	 * @return 如果设置了在输入为F时关闭显示则返回true
	 */
	boolean blankOnF() { return (flags & FLAG_BLANK_F) != 0; }
	
	/**
	 * 获取芯片引脚总数
	 * @return 如果有空白控制引脚则返回12，否则返回11
	 */
	int getPostCount() {
	    return hasBlank() ? 12 : 11;
	}
	/**
	 * 获取电压源数量
	 * @return 返回7个电压源，对应7个输出引脚
	 */
	int getVoltageSourceCount() {return 7;}

	/**
	 * 执行芯片逻辑，将输入译码为对应的七段显示输出
	 */
	void execute() {
	    // 读取4位二进制输入并转换为0-15的整数
	    int input=0;
	    if(pins[7].value)input+=8; // I3权重为8
	    if(pins[8].value)input+=4; // I2权重为4
	    if(pins[9].value)input+=2; // I1权重为2
	    if(pins[10].value)input+=1; // I0权重为1
	    
	    // 判断是否启用显示
	    boolean en = true;
	    if (hasBlank() && !pins[11].value) // 如果有空白控制引脚且为低电平
		en = false; // 禁用显示
	    
	    // 显示处理逻辑
	    if (!en || (input == 15 && blankOnF())) { // 如果禁用显示或输入为F且设置了在F时关闭显示
		// 关闭所有段
		for (int i = 0; i != 7; i++)
		    writeOutput(i, false);
	    } else {
		// 根据译码表设置各段输出
		for(int i=0;i<7;i++)
		    writeOutput(i, symbols[input][i]);
	    }
	}
	
        /**
         * 获取芯片编辑信息
         * 用于在芯片属性对话框中显示可编辑选项
         * @param n 选项索引
         * @return 对应的编辑信息
         */
        public EditInfo getChipEditInfo(int n) {
            if (n == 0) {
                // 第一个选项：是否启用空白控制引脚
                EditInfo ei = new EditInfo("", 0, -1, -1);
                ei.checkbox = new Checkbox("Blank Pin", hasBlank());
                return ei;
            }
            if (n == 1) {
                // 第二个选项：是否在输入为F(1111)时关闭显示
                EditInfo ei = new EditInfo("", 0, -1, -1);
                ei.checkbox = new Checkbox("Blank on 1111", blankOnF());
                return ei;        	
            }
            return super.getChipEditInfo(n);
        }
        /**
         * 设置芯片编辑值
         * 处理用户在属性对话框中对芯片进行的设置
         * @param n 选项索引
         * @param ei 包含用户设置的编辑信息
         */
        public void setChipEditValue(int n, EditInfo ei) {
            if (n == 0) {
                // 处理空白控制引脚设置
        	flags = ei.changeFlag(flags, FLAG_ENABLE);
        	setupPins(); // 重新设置引脚，因为引脚数量可能发生变化
        	setPoints(); // 重新计算坐标点
        	return;
            }
            if (n == 1)
                // 处理在F时关闭显示的设置
        	flags = ei.changeFlag(flags, FLAG_BLANK_F);
            super.setChipEditValue(n, ei);
        }

	/**
	 * 获取芯片的转储类型ID
	 * @return 七段译码器芯片的唯一标识符
	 */
	int getDumpType() { return 197; }

    }
