/*
 * 74LS148 8-3线优先编码器芯片
 * 将8个输入编码为3位二进制输出
 * 所有输入和输出都是低电平有效
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * 74LS148 8-3线优先编码器芯片
 * 引脚配置（16引脚DIP）：
 * 1: I4   2: I5   3: I6   4: I7
 * 5: EI   6: A2   7: A1   8: GND
 * 9: A0   10: I0  11: I1  12: I2
 * 13: I3  14: GS  15: EO  16: VCC
 * 
 * 所有输入和输出都是低电平有效
 * 优先级：I7 > I6 > I5 > I4 > I3 > I2 > I1 > I0
 */
class LS74148Elm extends ChipElm {
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
        g.drawString("74LS148", x, y + 66*csize);
        g.restore();
    }
    
    public LS74148Elm(int xx, int yy) { 
        super(xx, yy); 
    }
    
    /**
     * 从保存状态恢复芯片的构造函数
     */
    public LS74148Elm(int xa, int ya, int xb, int yb, int f,
            StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
    }
    
    /**
     * 获取芯片名称
     */
    @Override
    String getChipName() { return "74LS148"; }
    
    /**
     * 设置芯片引脚布局
     * 引脚功能（低电平有效）：
     * 左侧：1-I4, 2-I5, 3-I6, 4-I7, 5-EI, 6-A2, 7-A1, 8-GND
     * 右侧：16-VCC, 15-EO, 14-GS, 13-I3, 12-I2, 11-I1, 10-I0, 9-A0
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 8;
        pins = new Pin[getPostCount()];
        
        // 左侧引脚 (从上到下: 1,2,3,4,5,6,7,8)
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "I4" : "1");      // I4 (1) - 输入4
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "I5" : "2");      // I5 (2) - 输入5
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "I6" : "3");      // I6 (3) - 输入6
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "I7" : "4");      // I7 (4) - 输入7
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "EI" : "5");      // EI (5) - 使能输入
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "A2" : "6");      // A2 (6) - 输出位2
        pins[5].output = true;
        pins[6] = new Pin(6, SIDE_W, usePinNames() ? "A1" : "7");      // A1 (7) - 输出位1
        pins[6].output = true;
        pins[7] = new Pin(7, SIDE_W, usePinNames() ? "GND" : "8");     // GND (8)
        
        // 右侧引脚 (从上到下: 16,15,14,13,12,11,10,9)
        pins[15] = new Pin(0, SIDE_E, usePinNames() ? "VCC" : "16");   // VCC (16)
        pins[14] = new Pin(1, SIDE_E, usePinNames() ? "EO" : "15");    // EO (15) - 使能输出
        pins[14].output = true;
        pins[13] = new Pin(2, SIDE_E, usePinNames() ? "GS" : "14");    // GS (14) - 组信号输出
        pins[13].output = true;
        pins[12] = new Pin(3, SIDE_E, usePinNames() ? "I3" : "13");    // I3 (13) - 输入3
        pins[11] = new Pin(4, SIDE_E, usePinNames() ? "I2" : "12");    // I2 (12) - 输入2
        pins[10] = new Pin(5, SIDE_E, usePinNames() ? "I1" : "11");    // I1 (11) - 输入1
        pins[9] = new Pin(6, SIDE_E, usePinNames() ? "I0" : "10");     // I0 (10) - 输入0
        pins[8] = new Pin(7, SIDE_E, usePinNames() ? "A0" : "9");      // A0 (9) - 输出位0
        pins[8].output = true;
        
        allocNodes();
    }
    
    /**
     * 获取引脚总数
     */
    @Override
    int getPostCount() { return 16; }
    
    /**
     * 获取电压源数量
     * 对应5个输出引脚: A0, A1, A2, GS, EO
     */
    @Override
    int getVoltageSourceCount() { return 5; }
    
    /**
     * 执行芯片逻辑
     * 优先编码器逻辑（所有输入输出低电平有效）
     */
    @Override
    void execute() {
        // 检查VCC是否有足够电压供电
        boolean powered = pins[15].value; // 引脚16 (VCC)
        
        if (!powered) {
            // 无电源时，所有输出为低
            writeOutput(5, false);  // A2
            writeOutput(6, false);  // A1
            writeOutput(8, false);  // A0
            writeOutput(13, false); // GS
            writeOutput(14, false); // EO
            return;
        }
        
        // 获取使能输入（低电平有效）
        boolean ei = pins[4].value; // EI (引脚5)
        
        // 当EI为高时（禁用），所有输出为高
        if (ei) {
            writeOutput(5, true);   // A2 = 1
            writeOutput(6, true);   // A1 = 1
            writeOutput(8, true);   // A0 = 1
            writeOutput(13, true);  // GS = 1
            writeOutput(14, true);  // EO = 1
            return;
        }
        
        // 获取输入值（低电平有效，所以取反来判断是否激活）
        // 输入引脚映射: I0-pins[9], I1-pins[10], I2-pins[11], I3-pins[12], 
        //              I4-pins[0], I5-pins[1], I6-pins[2], I7-pins[3]
        boolean[] inputs = new boolean[8];
        inputs[0] = !pins[9].value;   // I0 (引脚10) - 低电平有效
        inputs[1] = !pins[10].value;  // I1 (引脚11)
        inputs[2] = !pins[11].value;  // I2 (引脚12)
        inputs[3] = !pins[12].value;  // I3 (引脚13)
        inputs[4] = !pins[0].value;   // I4 (引脚1)
        inputs[5] = !pins[1].value;   // I5 (引脚2)
        inputs[6] = !pins[2].value;   // I6 (引脚3)
        inputs[7] = !pins[3].value;   // I7 (引脚4)
        
        // 查找最高优先级的有效输入
        int highestPriority = -1;
        for (int i = 7; i >= 0; i--) {
            if (inputs[i]) {
                highestPriority = i;
                break;
            }
        }
        
        // 根据优先级设置输出
        if (highestPriority >= 0) {
            // 有输入激活
            // 输出编码（低电平有效）
            // I7激活→输出000, I6激活→输出001, I0激活→输出111
            // 输出是优先级数值的反码
            int code = highestPriority;
            // 如果该位为1，输出低电平(false)；如果该位为0，输出高电平(true)
            writeOutput(5, (code & 4) == 0);  // A2
            writeOutput(6, (code & 2) == 0);  // A1
            writeOutput(8, (code & 1) == 0);  // A0
            writeOutput(13, false);           // GS = 0 (有输入激活)
            writeOutput(14, true);            // EO = 1 (不传递使能)
        } else {
            // 无输入激活
            writeOutput(5, true);   // A2 = 1
            writeOutput(6, true);   // A1 = 1
            writeOutput(8, true);   // A0 = 1
            writeOutput(13, true);  // GS = 1 (无输入激活)
            writeOutput(14, false); // EO = 0 (传递使能到下一级)
        }
    }
    
    /**
     * 重置芯片状态
     * 74LS系列输入空载时默认为高电平（TTL内部上拉特性）
     */
    @Override
    void reset() {
        super.reset();
        // 设置所有输入引脚默认为高电平（未激活）
        // 模拟TTL芯片输入悬空=高电平的特性
        pins[0].value = true;   // I4
        pins[1].value = true;   // I5
        pins[2].value = true;   // I6
        pins[3].value = true;   // I7
        pins[4].value = true;   // EI (默认禁用)
        pins[9].value = true;   // I0
        pins[10].value = true;  // I1
        pins[11].value = true;  // I2
        pins[12].value = true;  // I3
    }
    
    /**
     * 获取芯片信息
     */
    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "74LS148 优先编码器";
        
        // 显示使能状态
        boolean ei = pins[4].value;
        arr[1] = "EI: " + (ei ? "禁用(1)" : "使能(0)");
        
        // 显示输出
        arr[2] = "输出: A2=" + (pins[5].value ? "1" : "0") +
                 " A1=" + (pins[6].value ? "1" : "0") +
                 " A0=" + (pins[8].value ? "1" : "0");
        arr[3] = "GS=" + (pins[13].value ? "1" : "0") +
                 " EO=" + (pins[14].value ? "1" : "0");
    }
    
    /**
     * 获取转储类型ID
     */
    @Override
    int getDumpType() { return 74148; }
    
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
