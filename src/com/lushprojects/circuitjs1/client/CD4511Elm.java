/*
 * CD4511 BCD到七段锁存/译码/驱动器芯片
 * 将4位BCD输入转换为七段显示输出
 * 具有锁存功能、消隐控制和测试模式
 * 可直接驱动共阴极七段数码管
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * CD4511 BCD到七段锁存/译码/驱动器芯片
 * 引脚配置（16引脚DIP）：
 * 1: A     2: B     3: LE    4: BI
 * 5: LT    6: C     7: D     8: GND
 * 9: a     10: b    11: c    12: d
 * 13: e    14: f    15: g    16: VCC
 * 
 * 功能说明：
 * - LE (锁存使能): 低电平时数据透过，高电平时锁存保持
 * - BI (消隐输入): 低电平时关闭所有显示段
 * - LT (测试输入): 低电平时点亮所有显示段
 */
class CD4511Elm extends ChipElm {
    // 标志位：显示引脚编号
    final int FLAG_NUMBERS = 2;
    
    /**
     * 判断是否显示引脚编号
     */
    boolean usePinNumbers() { return (flags & FLAG_NUMBERS) != 0; }
    
    /**
     * 判断是否显示引脚名称
     */
    boolean usePinNames() { return (flags & FLAG_NUMBERS) == 0; }
    
    /**
     * 在芯片下方绘制芯片型号标签
     */
    @Override
    void drawLabel(Graphics g, int x, int y) {
        g.save();
        if (sim.printableCheckItem.getState())
            g.setColor(Color.black);
        else
            g.setColor(Color.white);
        g.setFont(new Font("SansSerif", 0, 7*csize));
        g.context.setTextBaseline("middle");
        g.context.setTextAlign("center");
        g.drawString("CD4511", x, y + 80*csize);
        g.restore();
    }
    
    // 锁存的BCD值
    private int latchedValue;
    // 上一个LE状态
    private boolean lastLE;
    
    // BCD到七段显示译码表 (对应数字0-9)
    // 顺序: a, b, c, d, e, f, g
    private static final boolean[][] segments = {
        {true, true, true, true, true, true, false},    // 0: abcdef
        {false, true, true, false, false, false, false}, // 1: bc
        {true, true, false, true, true, false, true},    // 2: abdeg
        {true, true, true, true, false, false, true},    // 3: abcdg
        {false, true, true, false, false, true, true},   // 4: bcfg
        {true, false, true, true, false, true, true},    // 5: acdfg
        {true, false, true, true, true, true, true},     // 6: acdefg
        {true, true, true, false, false, false, false},  // 7: abc
        {true, true, true, true, true, true, true},      // 8: abcdefg
        {true, true, true, true, false, true, true}      // 9: abcdfg
    };

    public CD4511Elm(int xx, int yy) { 
        super(xx, yy);
        latchedValue = 0;
        lastLE = true;
    }
    
    /**
     * 从保存状态恢复芯片的构造函数
     */
    public CD4511Elm(int xa, int ya, int xb, int yb, int f,
            StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
        latchedValue = new Integer(st.nextToken()).intValue();
        lastLE = new Boolean(st.nextToken()).booleanValue();
    }
    
    /**
     * 获取芯片名称
     */
    @Override
    String getChipName() { return "CD4511"; }
    
    /**
     * 设置芯片引脚布局（原理图风格）
     * 左侧 (从上到下): VCC, BI, LT, A, B, C, D, LE, GND
     * 右侧 (从上到下): a, b, c, d, e, f, g
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 9;
        pins = new Pin[getPostCount()];
        
        // 左侧引脚 (从上到下)
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "VCC" : "16");   // VCC (16)
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "BI" : "4");     // BI (4) - 消隐输入
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "LT" : "5");     // LT (5) - 测试输入
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "A" : "1");      // A (1) - BCD输入 LSB
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "B" : "2");      // B (2) - BCD输入
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "C" : "6");      // C (6) - BCD输入
        pins[6] = new Pin(6, SIDE_W, usePinNames() ? "D" : "7");      // D (7) - BCD输入 MSB
        pins[7] = new Pin(7, SIDE_W, usePinNames() ? "LE" : "3");     // LE (3) - 锁存使能
        pins[8] = new Pin(8, SIDE_W, usePinNames() ? "GND" : "8");    // GND (8)
        
        // 右侧引脚 (从上到下: a, b, c, d, e, f, g)
        pins[9] = new Pin(0, SIDE_E, usePinNames() ? "a" : "9");      // a段输出 (9)
        pins[9].output = true;
        pins[10] = new Pin(1, SIDE_E, usePinNames() ? "b" : "10");    // b段输出 (10)
        pins[10].output = true;
        pins[11] = new Pin(2, SIDE_E, usePinNames() ? "c" : "11");    // c段输出 (11)
        pins[11].output = true;
        pins[12] = new Pin(3, SIDE_E, usePinNames() ? "d" : "12");    // d段输出 (12)
        pins[12].output = true;
        pins[13] = new Pin(4, SIDE_E, usePinNames() ? "e" : "13");    // e段输出 (13)
        pins[13].output = true;
        pins[14] = new Pin(5, SIDE_E, usePinNames() ? "f" : "14");    // f段输出 (14)
        pins[14].output = true;
        pins[15] = new Pin(6, SIDE_E, usePinNames() ? "g" : "15");    // g段输出 (15)
        pins[15].output = true;
        
        allocNodes();
    }
    
    /**
     * 获取引脚总数
     */
    @Override
    int getPostCount() { return 16; }
    
    /**
     * 获取电压源数量
     * 对应7个输出引脚: a, b, c, d, e, f, g
     */
    @Override
    int getVoltageSourceCount() { return 7; }
    
    /**
     * 执行芯片逻辑
     */
    @Override
    void execute() {
        // 获取控制信号
        boolean le = pins[7].value;  // LE (引脚3) - 锁存使能
        boolean bi = pins[1].value;  // BI (引脚4) - 消隐输入 (低电平有效)
        boolean lt = pins[2].value;  // LT (引脚5) - 测试输入 (低电平有效)
        
        // 消隐优先级最高 - BI为低时关闭所有显示
        if (!bi) {
            writeOutput(9, false);   // a
            writeOutput(10, false);  // b
            writeOutput(11, false);  // c
            writeOutput(12, false);  // d
            writeOutput(13, false);  // e
            writeOutput(14, false);  // f
            writeOutput(15, false);  // g
            return;
        }
        
        // 测试模式 - LT为低时点亮所有段
        if (!lt) {
            writeOutput(9, true);    // a
            writeOutput(10, true);   // b
            writeOutput(11, true);   // c
            writeOutput(12, true);   // d
            writeOutput(13, true);   // e
            writeOutput(14, true);   // f
            writeOutput(15, true);   // g
            return;
        }
        
        // 锁存功能 - LE为低时数据透过，LE上升沿时锁存当前值，LE为高时保持锁存值
        // 当LE=0或LE上升沿(lastLE=0且le=1)时，读取并更新BCD输入
        if (!le || !lastLE) {
            // 读取BCD输入
            int a = pins[3].value ? 1 : 0;  // A (引脚1)
            int b = pins[4].value ? 1 : 0;  // B (引脚2)
            int c = pins[5].value ? 1 : 0;  // C (引脚6)
            int d = pins[6].value ? 1 : 0;  // D (引脚7)
            latchedValue = a + (b << 1) + (c << 2) + (d << 3);
        }
        lastLE = le;
        
        // 根据锁存的BCD值设置七段输出
        if (latchedValue >= 0 && latchedValue <= 9) {
            // 有效BCD值(0-9)
            writeOutput(9, segments[latchedValue][0]);   // a
            writeOutput(10, segments[latchedValue][1]);  // b
            writeOutput(11, segments[latchedValue][2]);  // c
            writeOutput(12, segments[latchedValue][3]);  // d
            writeOutput(13, segments[latchedValue][4]);  // e
            writeOutput(14, segments[latchedValue][5]);  // f
            writeOutput(15, segments[latchedValue][6]);  // g
        } else {
            // 非法BCD值(10-15) - 所有段关闭
            writeOutput(9, false);   // a
            writeOutput(10, false);  // b
            writeOutput(11, false);  // c
            writeOutput(12, false);  // d
            writeOutput(13, false);  // e
            writeOutput(14, false);  // f
            writeOutput(15, false);  // g
        }
    }
    
    /**
     * 保存芯片状态
     */
    @Override
    String dump() {
        return super.dump() + " " + latchedValue + " " + lastLE;
    }

    /**
     * 重置芯片状态
     */
    @Override
    void reset() {
        super.reset();
        latchedValue = 0;
        lastLE = true;
        // CMOS输入默认为低电平
        for (int i = 0; i < pins.length; i++) {
            if (!pins[i].output) {
                pins[i].value = false;
            }
        }
        // LE, BI, LT默认高电平（正常工作模式）
        pins[7].value = true;  // LE
        pins[1].value = true;  // BI
        pins[2].value = true;  // LT
    }
    
    /**
     * 获取芯片信息
     */
    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "CD4511 BCD译码器";
        int a = pins[3].value ? 1 : 0;
        int b = pins[4].value ? 1 : 0;
        int c = pins[5].value ? 1 : 0;
        int d = pins[6].value ? 1 : 0;
        int bcdInput = a + (b << 1) + (c << 2) + (d << 3);
        arr[1] = "BCD输入: " + bcdInput + " (D=" + d + " C=" + c + " B=" + b + " A=" + a + ")";
        arr[2] = "锁存值: " + latchedValue;
        arr[3] = "LE=" + (pins[7].value ? "透过" : "锁存") +
                 " BI=" + (pins[1].value ? "正常" : "消隐") +
                 " LT=" + (pins[2].value ? "正常" : "测试");
    }
    
    /**
     * 获取转储类型ID
     */
    @Override
    int getDumpType() { return 4511; }
    
    /**
     * 获取芯片编辑信息
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
