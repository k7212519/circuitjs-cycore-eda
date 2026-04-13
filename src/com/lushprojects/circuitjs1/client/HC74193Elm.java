/*
 * 74HC193 4位同步二进制可逆计数器芯片
 * 支持加计数（CPU上升沿触发）和减计数（CPD上升沿触发）
 * 支持异步并行预置（/PL低电平有效）和异步主复位（MR高电平有效）
 * Create by k721519
 */
package com.lushprojects.circuitjs1.client;

/**
 * 74HC193 4位同步二进制可逆（升/降）计数器
 *
 * 原理图引脚布局（非物理DIP封装顺序）：
 *   左侧（从上到下）：VCC(16), CPU(5), CPD(4), MR(14), /PL(11), D0(15), D1(1), D2(10), D3(9), GND(8)
 *   右侧（从上到下）：（空3格）, Q0(3), Q1(2), Q2(6), Q3(7), TCU(12), TCD(13)
 *
 * 功能优先级（从高到低）：
 *   1. MR=H  → 异步复位 Q0~Q3=0000
 *   2. /PL=L → 异步并行加载 Qx=Dx
 *   3. CPU↑ (CPD=H) → 同步加计数 +1
 *   4. CPD↑ (CPU=H) → 同步减计数 -1
 *
 * TCU: 计数=15 且 CPU=L 时输出LOW（进位脉冲）
 * TCD: 计数=0  且 CPD=L 时输出LOW（借位脉冲）
 */
public class HC74193Elm extends ChipElm {

    // 标志位：显示物理引脚编号
    final int FLAG_NUMBERS = 2;

    // 两个时钟独立的上一帧状态（用于上升沿检测）
    boolean lastCpuClock = false;
    boolean lastCpdClock = false;
    boolean edgeStateValid = false;

    boolean usePinNumbers() { return (flags & FLAG_NUMBERS) != 0; }
    boolean usePinNames()   { return (flags & FLAG_NUMBERS) == 0; }

    /** 在芯片中央绘制型号标签 */
    @Override
    void drawLabel(Graphics g, int x, int y) {
        g.save();
        if (sim.printableCheckItem.getState())
            g.setColor(Color.black);
        else
            g.setColor(Color.white);
        g.setFont(new Font("SansSerif", 0, 7 * csize));
        g.context.setTextBaseline("middle");
        g.context.setTextAlign("center");
        g.drawString("74HC193", x, y + flippedSizeY * cspc + csize * 8);
        g.restore();
    }

    public HC74193Elm(int xx, int yy) {
        super(xx, yy);
    }

    public HC74193Elm(int xa, int ya, int xb, int yb, int f, StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
    }

    @Override
    String getChipName() { return "74HC193"; }

    /**
     * 引脚索引分配：
     *   [0]=CPU  [1]=CPD  [2]=MR   [3]=/PL
     *   [4]=D0   [5]=D1   [6]=D2   [7]=D3
     *   [8]=VCC  [9]=GND
     *   [10]=Q0  [11]=Q1  [12]=Q2  [13]=Q3
     *   [14]=TCU [15]=TCD
     */
    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 10;
        pins = new Pin[getPostCount()];

        // ── 左侧引脚 (SIDE_W，从上到下) ──
        pins[8]  = new Pin(0, SIDE_W, usePinNames() ? "VCC" : "16");   // VCC  物理16
        pins[0]  = new Pin(1, SIDE_W, usePinNames() ? "CPU" : "5");    // CPU  物理5
        pins[0].clock = true;
        pins[1]  = new Pin(2, SIDE_W, usePinNames() ? "CPD" : "4");    // CPD  物理4
        pins[1].clock = true;
        pins[2]  = new Pin(3, SIDE_W, usePinNames() ? "MR"  : "14");   // MR   物理14（高有效）
        pins[3]  = new Pin(4, SIDE_W, usePinNames() ? "PL"  : "11");   // /PL  物理11（低有效）
        pins[3].bubble = true;
        pins[4]  = new Pin(5, SIDE_W, usePinNames() ? "D0"  : "15");   // D0   物理15
        pins[5]  = new Pin(6, SIDE_W, usePinNames() ? "D1"  : "1");    // D1   物理1
        pins[6]  = new Pin(7, SIDE_W, usePinNames() ? "D2"  : "10");   // D2   物理10
        pins[7]  = new Pin(8, SIDE_W, usePinNames() ? "D3"  : "9");    // D3   物理9
        pins[9]  = new Pin(9, SIDE_W, usePinNames() ? "GND" : "8");    // GND  物理8

        // ── 右侧引脚 (SIDE_E，从上到下) ──
        pins[10] = new Pin(3, SIDE_E, usePinNames() ? "Q0"  : "3");    // Q0   物理3
        pins[10].output = pins[10].state = true;
        pins[11] = new Pin(4, SIDE_E, usePinNames() ? "Q1"  : "2");    // Q1   物理2
        pins[11].output = pins[11].state = true;
        pins[12] = new Pin(5, SIDE_E, usePinNames() ? "Q2"  : "6");    // Q2   物理6
        pins[12].output = pins[12].state = true;
        pins[13] = new Pin(6, SIDE_E, usePinNames() ? "Q3"  : "7");    // Q3   物理7
        pins[13].output = pins[13].state = true;
        pins[14] = new Pin(7, SIDE_E, usePinNames() ? "TCU" : "12");   // TCU  物理12（低有效）
        pins[14].output = true;
        pins[14].bubble = true;
        pins[15] = new Pin(8, SIDE_E, usePinNames() ? "TCD" : "13");   // TCD  物理13（低有效）
        pins[15].output = true;
        pins[15].bubble = true;

        allocNodes();
    }

    @Override
    int getPostCount() { return 16; }

    /** 输出引脚数：Q0,Q1,Q2,Q3,TCU,TCD 共6个 */
    @Override
    int getVoltageSourceCount() { return 6; }

    /**
     * 执行74HC193逻辑（每仿真步调用）
     *
     * 引脚读取：
     *   pins[0].value = CPU时钟当前电平
     *   pins[1].value = CPD时钟当前电平
     *   pins[2].value = MR（高→复位）
     *   pins[3].value = /PL（低→加载）
     *   pins[4-7].value = D0~D3输入
     *   pins[8].value = VCC供电
     *   pins[10-13].value = Q0~Q3当前输出（作为计数状态存储）
     */
    @Override
    void execute() {
        boolean powered = pins[8].value; // VCC

        if (!powered) {
            // 无电源：全部输出低
            for (int i = 10; i <= 15; i++)
                writeOutput(i, false);
            edgeStateValid = false;
            return;
        }

        boolean mr  = pins[2].value;  // MR  高电平有效
        boolean pl  = pins[3].value;  // /PL 低电平有效（pins读到实际电平，false=激活）
        boolean cpu = pins[0].value;  // CPU 时钟
        boolean cpd = pins[1].value;  // CPD 时钟
        boolean suppressEdgeCounts = !edgeStateValid;

        // 初始化、仿真复位或重新上电后，先对齐边沿状态，避免把稳定高电平误判成新的上升沿。
        if (suppressEdgeCounts) {
            lastCpuClock = cpu;
            lastCpdClock = cpd;
            edgeStateValid = true;
        }

        // 从Q输出引脚重建当前计数值（支持save/load自动恢复）
        int count = (pins[10].value ? 1 : 0)
                  | (pins[11].value ? 2 : 0)
                  | (pins[12].value ? 4 : 0)
                  | (pins[13].value ? 8 : 0);

        // ── 优先级1：异步主复位（MR高有效） ──
        if (mr) {
            count = 0;
        }
        // ── 优先级2：异步并行加载（/PL低有效） ──
        else if (!pl) {
            count = (pins[4].value ? 1 : 0)   // D0
                  | (pins[5].value ? 2 : 0)   // D1
                  | (pins[6].value ? 4 : 0)   // D2
                  | (pins[7].value ? 8 : 0);  // D3
        }
        // ── 优先级3：同步计数（均不激活时） ──
        else {
            // 加计数：CPU 上升沿（L→H），且CPD保持HIGH
            if (!suppressEdgeCounts && cpu && !lastCpuClock && cpd) {
                count = (count + 1) & 0xF;  // +1，溢出回绕 15→0
            }
            // 减计数：CPD 上升沿（L→H），且CPU保持HIGH
            if (!suppressEdgeCounts && cpd && !lastCpdClock && cpu) {
                count = (count - 1) & 0xF;  // -1，借位回绕 0→15
            }
        }

        // ── 更新Q0~Q3输出 ──
        writeOutput(10, (count & 1) != 0);  // Q0
        writeOutput(11, (count & 2) != 0);  // Q1
        writeOutput(12, (count & 4) != 0);  // Q2
        writeOutput(13, (count & 8) != 0);  // Q3

        // ── TCU：count=15 且 CPU=LOW 时输出LOW（进位脉冲） ──
        writeOutput(14, !(count == 15 && !cpu));

        // ── TCD：count=0 且 CPD=LOW 时输出LOW（借位脉冲） ──
        writeOutput(15, !(count == 0 && !cpd));

        // 保存时钟状态（下一步上升沿检测用）
        lastCpuClock = cpu;
        lastCpdClock = cpd;
    }

    /** 重置芯片（仿真复位时调用） */
    @Override
    void reset() {
        super.reset();
        lastCpuClock = false;
        lastCpdClock = false;
        edgeStateValid = false;
        // TCU/TCD 复位后为高电平（空闲状态）
        if (pins != null && pins[14] != null) {
            pins[14].value = true;
            pins[15].value = true;
        }
    }

    /** 状态栏信息显示 */
    @Override
    void getInfo(String arr[]) {
        arr[0] = "74HC193 可逆计数器";
        int count = (pins[10].value ? 1 : 0)
                  | (pins[11].value ? 2 : 0)
                  | (pins[12].value ? 4 : 0)
                  | (pins[13].value ? 8 : 0);
        arr[1] = "计数值: " + count + "  二进制: "
               + (pins[13].value ? "1" : "0")
               + (pins[12].value ? "1" : "0")
               + (pins[11].value ? "1" : "0")
               + (pins[10].value ? "1" : "0");
        arr[2] = "TCU=" + (pins[14].value ? "H" : "L")
               + "   TCD=" + (pins[15].value ? "H" : "L");
        if (pins[2].value)
            arr[3] = "状态: 主复位 (MR=H)";
        else if (!pins[3].value)
            arr[3] = "状态: 并行加载 (/PL=L)";
        else if (pins[1].value && !pins[0].value)
            arr[3] = "状态: 等待加计数沿 (CPD=H, CPU=L)";
        else if (pins[0].value && !pins[1].value)
            arr[3] = "状态: 等待减计数沿 (CPU=H, CPD=L)";
        else if (!pins[0].value && !pins[1].value)
            arr[3] = "状态: 两个时钟同时为低";
        else
            arr[3] = "状态: 保持 (CPU=H, CPD=H)";
    }

    /** 转储类型ID（用于电路文件保存/加载，唯一值） */
    @Override
    int getDumpType() { return 74193; }

    @Override
    public EditInfo getChipEditInfo(int n) {
        if (n == 0) {
            return EditInfo.createCheckbox("显示引脚编号", usePinNumbers());
        }
        return super.getChipEditInfo(n);
    }

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
