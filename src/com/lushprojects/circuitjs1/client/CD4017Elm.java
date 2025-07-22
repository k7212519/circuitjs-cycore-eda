/*
 * CD4017 十进制计数器/分配器芯片
 * 具有10个输出（Q0~Q9），每来一个时钟脉冲，输出依次置高
 * 具有进位输出（CO）、时钟使能（EN，低有效）、复位（R，高有效）
 * 参考: https://www.ariat-tech.tw/blog/Your-Guide-into-CD4017-IC.html
 */
package com.lushprojects.circuitjs1.client;



class CD4017Elm extends ChipElm {
    final int FLAG_NUMBERS = 2;
    private int counter; // 0~9
    private boolean lastClock;
    private boolean lastReset;
    
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
        g.drawString("CD4017", x, y + 96*csize);
        g.restore();
    }
    
    public CD4017Elm(int xx, int yy) {
        super(xx, yy);
        counter = 0;
        lastClock = false;
        lastReset = false;
    }

    public CD4017Elm(int xa, int ya, int xb, int yb, int f, com.lushprojects.circuitjs1.client.StringTokenizer st) {
        super(xa, ya, xb, yb, f, st);
        if (st.hasMoreTokens()) counter = Integer.parseInt(st.nextToken());
        if (st.hasMoreTokens()) lastClock = Boolean.parseBoolean(st.nextToken());
        if (st.hasMoreTokens()) lastReset = Boolean.parseBoolean(st.nextToken());
    }

    @Override
    String getChipName() { return "CD4017 Decade Counter"; }

    boolean usePinNumbers() { return (flags & FLAG_NUMBERS) != 0; }
    boolean usePinNames() { return (flags & FLAG_NUMBERS) == 0; }

    @Override
    void setupPins() {
        sizeX = 3;
        sizeY = 10;
        pins = new Pin[16];

        // 左侧引脚: 16, 14, 12, 8, 13, 15
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "VCC" : "16"); // VCC
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "CLK" : "14"); // CLK
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "CO" : "12");  // CO
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "GND" : "8");  // GND
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "EN" : "13");  // EN
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "R" : "15");   // R

        // 右侧引脚: 3, 2, 4, 7, 10, 1, 5, 6, 9, 11
        pins[6] = new Pin(0, SIDE_E, usePinNames() ? "Q0" : "3");
        pins[7] = new Pin(1, SIDE_E, usePinNames() ? "Q1" : "2");
        pins[8] = new Pin(2, SIDE_E, usePinNames() ? "Q2" : "4");
        pins[9] = new Pin(3, SIDE_E, usePinNames() ? "Q3" : "7");
        pins[10] = new Pin(4, SIDE_E, usePinNames() ? "Q4" : "10");
        pins[11] = new Pin(5, SIDE_E, usePinNames() ? "Q5" : "1");
        pins[12] = new Pin(6, SIDE_E, usePinNames() ? "Q6" : "5");
        pins[13] = new Pin(7, SIDE_E, usePinNames() ? "Q7" : "6");
        pins[14] = new Pin(8, SIDE_E, usePinNames() ? "Q8" : "9");
        pins[15] = new Pin(9, SIDE_E, usePinNames() ? "Q9" : "11");

        // 输入/输出类型
        pins[1].clock = true;   // CLK
        pins[2].output = true;  // CO
        for (int i = 6; i <= 15; i++) {
            pins[i].output = true; // Q0-Q9
        }
    }

    @Override
    int getPostCount() { return 16; }
    @Override
    int getVoltageSourceCount() { return 11; } // Q0~Q9+CO

    @Override
    void execute() {
        boolean clk = pins[1].value;
        boolean en = !pins[4].value; // EN为低有效
        boolean rst = pins[5].value;

        // 复位优先
        if (rst) {
            counter = 0;
        } else if (en && !lastClock && clk) { // 时钟上升沿且使能
            counter = (counter + 1) % 10;
        }
        lastClock = clk;
        lastReset = rst;
        // Q0~Q9输出
        for (int i = 0; i < 10; i++) {
            int pinIdx = getQPinIndex(i);
            writeOutput(pinIdx, counter == i);
        }
        // CO输出：Q0~Q4输出高时CO高，Q5~Q9输出高时CO低
        writeOutput(2, counter < 5);
    }

    private int getQPinIndex(int n) {
        // Q0~Q9: pins[6~15]
        return n + 6;
    }

    @Override
    String dump() {
        return super.dump() + " " + counter + " " + lastClock + " " + lastReset;
    }

    @Override
    void reset() {
        super.reset();
        counter = 0;
        lastClock = false;
        lastReset = false;
    }

    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "CD4017 十进制计数器";
        arr[1] = "计数: " + counter;
        arr[2] = "CLK = " + (pins[1].value ? "高" : "低");
        arr[3] = "EN = " + (pins[4].value ? "高" : "低") + " R = " + (pins[5].value ? "高" : "低");
        arr[4] = "CO = " + (pins[2].value ? "高" : "低");
    }

    @Override
    int getDumpType() { return 4017; } // 唯一ID

    @Override
    public EditInfo getChipEditInfo(int n) {
        if (n == 0) {
            EditInfo ei = EditInfo.createCheckbox("显示引脚编号", usePinNumbers());
            return ei;
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
