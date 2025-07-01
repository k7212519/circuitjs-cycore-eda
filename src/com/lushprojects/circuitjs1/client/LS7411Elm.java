/*
 * 74LS11 三输入与门芯片
 * 包含三个三输入与门，可以分别独立使用
 * 引脚布局遵循标准74系列芯片规范
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * 74LS11 三输入与门芯片
 * 包含三个三输入与门，每个与门都有三个输入和一个输出
 * 只有当三个输入都为高电平时，输出才为高电平
 */
class LS7411Elm extends ChipElm {
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
    
    public LS7411Elm(int xx, int yy) { 
        super(xx, yy); 
    }
    
    /**
     * 从保存状态恢复芯片的构造函数
     */
    public LS7411Elm(int xa, int ya, int xb, int yb, int f,
            StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
    }
    
    /**
     * 获取芯片名称
     */
    @Override
    String getChipName() { return "74LS11"; }
    
    /**
     * 设置芯片引脚布局
     * 引脚功能：
     * 1, 2, 13 - 第一个与门的输入
     * 3, 4, 5 - 第二个与门的输入
     * 9, 10, 11 - 第三个与门的输入
     * 12 - 第一个与门的输出
     * 6 - 第二个与门的输出
     * 8 - 第三个与门的输出
     * 7 - 接地 (GND)
     * 14 - 电源 (VCC)
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 7;  // 增加芯片高度
        pins = new Pin[getPostCount()];
        
        // 左侧引脚
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "A1" : "1");      // 第一个与门的输入A (1)
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "B1" : "2");      // 第一个与门的输入B (2)
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "A2" : "3");      // 第二个与门的输入A (3)
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "B2" : "4");      // 第二个与门的输入B (4)
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "C2" : "5");      // 第二个与门的输入C (5)
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "Y2" : "6");      // 第二个与门的输出 (6)
        pins[5].output = true;
        pins[6] = new Pin(6, SIDE_W, usePinNames() ? "GND" : "7");     // 接地 (7)
        
        // 右侧引脚
        pins[13] = new Pin(0, SIDE_E, usePinNames() ? "VCC" : "14");   // 电源 (14)
        pins[12] = new Pin(1, SIDE_E, usePinNames() ? "C1" : "13");    // 第一个与门的输入C (13)
        pins[11] = new Pin(2, SIDE_E, usePinNames() ? "Y1" : "12");    // 第一个与门的输出 (12)
        pins[11].output = true;
        pins[10] = new Pin(3, SIDE_E, usePinNames() ? "A3" : "11");    // 第三个与门的输入A (11)
        pins[9] = new Pin(4, SIDE_E, usePinNames() ? "B3" : "10");     // 第三个与门的输入B (10)
        pins[8] = new Pin(5, SIDE_E, usePinNames() ? "C3" : "9");      // 第三个与门的输入C (9)
        pins[7] = new Pin(6, SIDE_E, usePinNames() ? "Y3" : "8");      // 第三个与门的输出 (8)
        pins[7].output = true;
        
        allocNodes();
    }
    
    /**
     * 获取引脚总数
     * @return 返回14个引脚
     */
    @Override
    int getPostCount() { return 14; }
    
    /**
     * 获取电压源数量
     * 对应3个输出引脚
     */
    @Override
    int getVoltageSourceCount() { return 3; }
    
    /**
     * 执行芯片逻辑
     */
    @Override
    void execute() {
        // 第一个与门 (输入引脚1,2,13；输出引脚12)
        boolean gate1InputA = pins[0].value; // 引脚1
        boolean gate1InputB = pins[1].value; // 引脚2
        boolean gate1InputC = pins[12].value; // 引脚13
        boolean gate1Output = gate1InputA && gate1InputB && gate1InputC;
        writeOutput(11, gate1Output); // 引脚12
        
        // 第二个与门 (输入引脚3,4,5；输出引脚6)
        boolean gate2InputA = pins[2].value; // 引脚3
        boolean gate2InputB = pins[3].value; // 引脚4
        boolean gate2InputC = pins[4].value; // 引脚5
        boolean gate2Output = gate2InputA && gate2InputB && gate2InputC;
        writeOutput(5, gate2Output); // 引脚6
        
        // 第三个与门 (输入引脚9,10,11；输出引脚8)
        boolean gate3InputA = pins[10].value; // 引脚11
        boolean gate3InputB = pins[9].value;  // 引脚10
        boolean gate3InputC = pins[8].value;  // 引脚9
        boolean gate3Output = gate3InputA && gate3InputB && gate3InputC;
        writeOutput(7, gate3Output); // 引脚8
    }
    
    /**
     * 重置芯片状态
     */
    @Override
    void reset() {
        super.reset();
    }
    
    /**
     * 获取芯片信息
     */
    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "74LS11 三输入与门";
        arr[1] = "与门1: " + (pins[0].value ? "1" : "0") + " AND " + 
                 (pins[1].value ? "1" : "0") + " AND " + 
                 (pins[12].value ? "1" : "0") + " = " + 
                 (pins[11].value ? "1" : "0");
        arr[2] = "与门2: " + (pins[2].value ? "1" : "0") + " AND " + 
                 (pins[3].value ? "1" : "0") + " AND " + 
                 (pins[4].value ? "1" : "0") + " = " + 
                 (pins[5].value ? "1" : "0");
        arr[3] = "与门3: " + (pins[10].value ? "1" : "0") + " AND " + 
                 (pins[9].value ? "1" : "0") + " AND " + 
                 (pins[8].value ? "1" : "0") + " = " + 
                 (pins[7].value ? "1" : "0");
    }
    
    /**
     * 获取转储类型ID
     */
    @Override
    int getDumpType() { return 7411; } // 分配一个唯一的ID给74LS11Elm
    
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
