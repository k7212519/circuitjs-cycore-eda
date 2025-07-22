/*
 * 74HC32 四双输入或门芯片
 * 包含四个双输入或门，可以分别独立使用
 * 引脚布局遵循标准74系列芯片规范
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * 74HC32 四双输入或门芯片
 * 包含四个双输入或门，每个或门都有两个输入和一个输出
 * 当至少一个输入为高电平时，输出为高电平
 */
public class HC7432Elm extends ChipElm {
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
        // 根据背景色自动选择文字颜色
        if (sim.printableCheckItem.getState())
            g.setColor(Color.black); // 白色背景时使用黑色文字
        else
            g.setColor(Color.white); // 黑色背景时使用白色文字
        g.setFont(new Font("SansSerif", 0, 7*csize));
        g.context.setTextBaseline("middle");
        g.context.setTextAlign("center");
        // 在芯片下方绘制型号标签
        g.drawString("74HC32 OR", x, y + 66*csize);
        g.restore();
    }
    
    public HC7432Elm(int xx, int yy) { 
        super(xx, yy); 
    }
    
    /**
     * 从保存状态恢复芯片的构造函数
     */
    public HC7432Elm(int xa, int ya, int xb, int yb, int f,
            StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
    }
    
    /**
     * 获取芯片名称
     */
    @Override
    String getChipName() { return "74HC32"; }
    
    /**
     * 设置芯片引脚布局
     * 引脚功能：
     * 1, 2 - 第一个或门的输入A, B
     * 3 - 第一个或门的输出Y
     * 4, 5 - 第二个或门的输入A, B
     * 6 - 第二个或门的输出Y
     * 7 - 接地 (GND)
     * 8 - 第三个或门的输出Y
     * 9, 10 - 第三个或门的输入B, A
     * 11 - 第四个或门的输出Y
     * 12, 13 - 第四个或门的输入B, A
     * 14 - 电源 (VCC)
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 7;  // 设置芯片高度
        pins = new Pin[getPostCount()];
        
        // 左侧引脚
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "1A" : "1");      // 第一个或门的输入A (1)
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "1B" : "2");      // 第一个或门的输入B (2)
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "1Y" : "3");      // 第一个或门的输出Y (3)
        pins[2].output = true;
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "2A" : "4");      // 第二个或门的输入A (4)
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "2B" : "5");      // 第二个或门的输入B (5)
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "2Y" : "6");      // 第二个或门的输出Y (6)
        pins[5].output = true;
        pins[6] = new Pin(6, SIDE_W, usePinNames() ? "GND" : "7");     // 接地 (7)
        
        // 右侧引脚
        pins[13] = new Pin(0, SIDE_E, usePinNames() ? "VCC" : "14");   // 电源 (14)
        pins[12] = new Pin(1, SIDE_E, usePinNames() ? "4A" : "13");    // 第四个或门的输入A (13)
        pins[11] = new Pin(2, SIDE_E, usePinNames() ? "4B" : "12");    // 第四个或门的输入B (12)
        pins[10] = new Pin(3, SIDE_E, usePinNames() ? "4Y" : "11");    // 第四个或门的输出Y (11)
        pins[10].output = true;
        pins[9] = new Pin(4, SIDE_E, usePinNames() ? "3A" : "10");     // 第三个或门的输入A (10)
        pins[8] = new Pin(5, SIDE_E, usePinNames() ? "3B" : "9");      // 第三个或门的输入B (9)
        pins[7] = new Pin(6, SIDE_E, usePinNames() ? "3Y" : "8");      // 第三个或门的输出Y (8)
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
     * 对应4个输出引脚
     */
    @Override
    int getVoltageSourceCount() { return 4; }
    
    /**
     * 执行芯片逻辑
     */
    @Override
    void execute() {
        // 检查VCC是否有足够电压供电
        boolean powered = pins[13].value; // 引脚14 (VCC)
        
        // 第一个或门 (输入引脚1,2；输出引脚3)
        boolean gate1InputA = pins[0].value; // 引脚1
        boolean gate1InputB = pins[1].value; // 引脚2
        boolean gate1Output = powered && (gate1InputA || gate1InputB); // 或操作
        writeOutput(2, gate1Output); // 引脚3
        
        // 第二个或门 (输入引脚4,5；输出引脚6)
        boolean gate2InputA = pins[3].value; // 引脚4
        boolean gate2InputB = pins[4].value; // 引脚5
        boolean gate2Output = powered && (gate2InputA || gate2InputB); // 或操作
        writeOutput(5, gate2Output); // 引脚6
        
        // 第三个或门 (输入引脚9,10；输出引脚8)
        boolean gate3InputA = pins[9].value; // 引脚10
        boolean gate3InputB = pins[8].value; // 引脚9
        boolean gate3Output = powered && (gate3InputA || gate3InputB); // 或操作
        writeOutput(7, gate3Output); // 引脚8
        
        // 第四个或门 (输入引脚12,13；输出引脚11)
        boolean gate4InputA = pins[12].value; // 引脚13
        boolean gate4InputB = pins[11].value; // 引脚12
        boolean gate4Output = powered && (gate4InputA || gate4InputB); // 或操作
        writeOutput(10, gate4Output); // 引脚11
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
        arr[0] = "74HC32 四双输入或门";
        arr[1] = "或门1: " + (pins[0].value ? "1" : "0") + " OR " + 
                 (pins[1].value ? "1" : "0") + " = " + 
                 (pins[2].value ? "1" : "0");
        arr[2] = "或门2: " + (pins[3].value ? "1" : "0") + " OR " + 
                 (pins[4].value ? "1" : "0") + " = " + 
                 (pins[5].value ? "1" : "0");
        arr[3] = "或门3: " + (pins[9].value ? "1" : "0") + " OR " + 
                 (pins[8].value ? "1" : "0") + " = " + 
                 (pins[7].value ? "1" : "0");
        arr[4] = "或门4: " + (pins[12].value ? "1" : "0") + " OR " + 
                 (pins[11].value ? "1" : "0") + " = " + 
                 (pins[10].value ? "1" : "0");
    }
    
    /**
     * 获取转储类型ID
     */
    @Override
    int getDumpType() { return 7432; } // 分配一个唯一的ID给74HC32Elm
    
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
