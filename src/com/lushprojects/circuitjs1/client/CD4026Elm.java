/*
 * CD4026 十进制计数器及七段译码器芯片
 * 此芯片结合了十进制计数器和七段显示译码器功能，可以直接驱动共阴极七段数码管
 * 每次时钟上升沿计数加1，计数范围0-9，并输出对应的七段显示信号
 * 具有级联功能，可以通过CO引脚连接多个芯片实现多位数显示
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * CD4026 十进制计数器及七段译码器芯片
 * 此芯片结合了十进制计数器和七段显示译码器功能，可以直接驱动共阴极七段数码管
 * 每次时钟上升沿计数加1，计数范围0-9，并输出对应的七段显示信号
 * 具有级联功能，可以通过CO引脚连接多个芯片实现多位数显示
 */
class CD4026Elm extends ChipElm {
    // 标志位：显示引脚编号
    final int FLAG_NUMBERS = 2;
    
    /**
     * 判断是否显示引脚编号
     * @return 如果设置了FLAG_NUMBERS标志位则返回true
     */
    boolean usePinNumbers() { return (flags & FLAG_NUMBERS) != 0; }
    
    /**
     * 判断是否显示引脚名称
     * @return 如果没有设置 FLAG_NUMBERS 标志位则返回 true
     */
    boolean usePinNames() { return (flags & FLAG_NUMBERS) == 0; }
    
    /**
     * 在芯片下方绘制芯片型号标签
     */
    @Override
    void drawLabel(Graphics g, int x, int y) {
        g.save();
        g.setColor(Color.white);
        g.setFont(new Font("SansSerif", 0, 7*csize));
        g.context.setTextBaseline("middle");
        g.context.setTextAlign("center");
        // 在芯片下方绘制型号标签
        g.drawString("CD4026", x, y + 76*csize);
        g.restore();
    }
    
    // 芯片的当前计数值(0-9)
    private int counter;
    // 上一个时钟状态
    private boolean lastClock;
    // 上一个复位状态
    private boolean lastReset;
    // 时钟被禁用状态
    private boolean clockInhibit;
    // 输出使能状态
    private boolean enableDisplay;
    
    // 用于显示的七段译码表，对应数字0-9的显示
    private static final boolean[][] segments = {
        {true, false, true, true, true, true, true},    // 0
        {false, false, false, false, false, true, true}, // 1
        {false, true, true, true, true, true, false},    // 2
        {false, true, true, true, false, true, true},    // 3
        {true, true, false, false, false, true, true},   // 4
        {true, true, true, true, false, false, true},    // 5
        {true, true, true, true, true, false, true},     // 6
        {false, false, false, true, false, true, true},  // 7
        {true, true, true, true, true, true, true},      // 8
        {true, true, true, true, false, true, true}      // 9
        // f,   g  ,   d  , a  ,  e   ,  b  ,  c   
    };

    public CD4026Elm(int xx, int yy) { 
        super(xx, yy); 
        counter = 0;
        lastClock = false;
        lastReset = false;
        clockInhibit = false;
        enableDisplay = true;
    }
    
    /**
     * 从保存状态恢复芯片的构造函数
     */
    public CD4026Elm(int xa, int ya, int xb, int yb, int f,
            StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
        counter = new Integer(st.nextToken()).intValue();
        lastClock = new Boolean(st.nextToken()).booleanValue();
        lastReset = new Boolean(st.nextToken()).booleanValue();
        clockInhibit = new Boolean(st.nextToken()).booleanValue();
        enableDisplay = new Boolean(st.nextToken()).booleanValue();
    }
    
    /**
     * 获取芯片名称
     */
    @Override
    String getChipName() { return "CD4026 Counter"; }
    
    /**
     * 设置芯片引脚布局
     * 引脚功能：
     * 1 - 时钟输入 (CLK)
     * 2 - 时钟禁用 (INH)
     * 3 - 输出使能 (DEI)
     * 4 - 使能输出 (DEO)
     * 5 - 进位输出 (CO)
     * 6-13 - 七段显示输出 (a-g)
     * 14 - 无门C段输出 (UCS)
     * 15 - 复位 (RST)
     * 8 - 接地 (GND)
     * 16 - 电源 (VCC)
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 8;
        pins = new Pin[getPostCount()];
        
        // 左侧引脚 - 按图片显示的顺序
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "CLK" : "1");      // 时钟输入 (1)
        pins[2] = new Pin(1, SIDE_W, usePinNames() ? "DEI" : "3");      // 输出使能 (3)
        pins[1] = new Pin(2, SIDE_W, usePinNames() ? "INH" : "2");      // 时钟禁用 (2)
        pins[14] = new Pin(3, SIDE_W, usePinNames() ? "RST" : "15");     // 复位 (15)
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "CO" : "5");       // 进位输出 (5)
        pins[4].output = true;
        pins[13] = new Pin(5, SIDE_W, usePinNames() ? "UCS" : "14");     // 无门C段输出 (14)
        pins[13].output = true;
        pins[7] = new Pin(6, SIDE_W, usePinNames() ? "GND" : "8");      // 接地 (8)

        // 右侧引脚 - 按图片显示的顺序
        pins[15] = new Pin(0, SIDE_E, usePinNames() ? "VCC" : "16");     // 电源 (16)
        pins[9] = new Pin(1, SIDE_E, usePinNames() ? "a" : "10");        // a段输出 (10)
        pins[9].output = true;
        pins[11] = new Pin(2, SIDE_E, usePinNames() ? "b" : "12");       // b段输出 (12)
        pins[11].output = true;
        pins[12] = new Pin(3, SIDE_E, usePinNames() ? "c" : "13");       // c段输出 (13)
        pins[12].output = true;
        pins[8] = new Pin(4, SIDE_E, usePinNames() ? "d" : "9");        // d段输出 (9)
        pins[8].output = true;
        pins[10] = new Pin(5, SIDE_E, usePinNames() ? "e" : "11");       // e段输出 (11)
        pins[10].output = true;
        pins[5] = new Pin(6, SIDE_E, usePinNames() ? "f" : "6");        // f段输出 (6)
        pins[5].output = true;
        pins[6] = new Pin(7, SIDE_E, usePinNames() ? "g" : "7");        // g段输出 (7)
        pins[6].output = true;
        
        // DEO引脚(引脚4)放在8号引脚下方
        pins[3] = new Pin(7, SIDE_W, usePinNames() ? "DEO" : "4");      // 使能输出 (4)
        pins[3].output = true;
        
        allocNodes();
    }
    
    /**
     * 获取引脚总数
     * @return 返回16个引脚
     */
    @Override
    int getPostCount() { return 16; }
    
    /**
     * 获取电压源数量
     * 对应9个输出引脚：DEO, CO, a, b, c, d, e, f, g, UCS
     */
    @Override
    int getVoltageSourceCount() { return 10; }
    
    /**
     * 执行芯片逻辑
     */
    @Override
    void execute() {
        // 检查复位引脚
        boolean reset = pins[14].value; // 引脚15 (RST)
        if (reset && !lastReset) {
            counter = 0; // 复位计数器
        }
        lastReset = reset;
        
        // 检查时钟禁用和输出使能
        clockInhibit = pins[1].value; // 引脚2 (INH)
        enableDisplay = pins[2].value; // 引脚3 (DEI)
        
        // 检查时钟上升沿
        boolean currentClockState = pins[0].value; // 引脚1 (CLK)
        // 计算有效的时钟边沿条件，这个条件将用于计数和CO
        boolean validClockEdgeForCount = currentClockState && !lastClock && !clockInhibit;

        if (validClockEdgeForCount) {
            // 时钟上升沿，计数加1
            counter = (counter + 1) % 10;
        }
        lastClock = currentClockState; // 为下一个周期更新lastClock
        
        // 输出使能引脚(DEO)应该与输入使能引脚(DEI)保持一致
        writeOutput(3, enableDisplay);
        
        // 进位输出 (CO - 引脚5) - 当计数为0-4时输出高电平，5-9时输出低电平
        writeOutput(4, counter <= 4);
        
        // 无门C段输出 - 当计数不为2时为高电平
        writeOutput(13, counter != 2); // 引脚14 (UCS)
        
        // 如果显示使能，则根据当前计数值设置七段显示输出
        if (enableDisplay) {
            // f段输出 (引脚6  -> pins[5])  驱动 segments[counter][0]
            writeOutput(5, segments[counter][0]);
            // g段输出 (引脚7  -> pins[6])  驱动 segments[counter][1]
            writeOutput(6, segments[counter][1]);
            // d段输出 (引脚9  -> pins[8])  驱动 segments[counter][2]
            writeOutput(8, segments[counter][2]);
            // a段输出 (引脚10 -> pins[9])  驱动 segments[counter][3]
            writeOutput(9, segments[counter][3]);
            // e段输出 (引脚11 -> pins[10]) 驱动 segments[counter][4]
            writeOutput(10, segments[counter][4]);
            // b段输出 (引脚12 -> pins[11]) 驱动 segments[counter][5]
            writeOutput(11, segments[counter][5]);
            // c段输出 (引脚13 -> pins[12]) 驱动 segments[counter][6]
            writeOutput(12, segments[counter][6]);
        } else {
            // 显示禁用，所有段输出为低
            writeOutput(5, false);  // f (引脚6)
            writeOutput(6, false);  // g (引脚7)
            writeOutput(8, false);  // d (引脚9)
            writeOutput(9, false);  // a (引脚10)
            writeOutput(10, false); // e (引脚11)
            writeOutput(11, false); // b (引脚12)
            writeOutput(12, false); // c (引脚13)
        }
    }
    
    /**
     * 保存芯片状态
     */
    @Override
    String dump() {
        return super.dump() + " " + counter + " " + lastClock + " " + 
               lastReset + " " + clockInhibit + " " + enableDisplay;
    }

    /**
     * 重置芯片状态
     */
    @Override
    void reset() {
        super.reset();
        counter = 0;
        lastClock = false;
        lastReset = false;
        clockInhibit = false;
        enableDisplay = true;
    }
    
    /**
     * 获取芯片信息
     */
    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "CD4026 十进制计数器";
        arr[1] = "计数: " + counter;
        arr[2] = "CLK = " + (pins[0].value ? "高" : "低");
        arr[3] = "INH = " + (pins[1].value ? "高" : "低") + 
                 " DEI = " + (pins[2].value ? "高" : "低");
        arr[4] = "RST = " + (pins[12].value ? "高" : "低");
        arr[5] = "CO = " + (pins[4].value ? "高" : "低") + 
                 " DEO = " + (pins[3].value ? "高" : "低");
    }
    
    /**
     * 获取转储类型ID
     */
    @Override
    int getDumpType() { return 4026; } // 分配一个唯一的ID给CD4026Elm
    
    /**
     * 获取芯片编辑信息
     * 用于在芯片属性对话框中显示可编辑选项
     * @param n 选项索引
     * @return 对应的编辑信息
     */
    @Override
    public EditInfo getChipEditInfo(int n) {
        if (n == 0) {
            EditInfo ei = EditInfo.createCheckbox("显示引脚编号", usePinNumbers());
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
    @Override
    public void setChipEditValue(int n, EditInfo ei) {
        if (n == 0) {
            flags = ei.changeFlag(flags, FLAG_NUMBERS);
            setupPins();
            setPoints();
            return;
        }
        super.setChipEditValue(n, ei);
    }
}