/*
 * CD4017 十进制计数器/分配器芯片
 * 具有10个输出（Q0~Q9），每来一个时钟脉冲，输出依次置高
 * 具有进位输出（CO）、时钟使能（EN，低有效）、复位（R，高有效）
 * 参考: https://www.ti.com/product/CD4017B
 * 功能级供电近似，不模拟 CMOS 驱动曲线、传播延迟或输入保护二极管。
 */
package com.lushprojects.circuitjs1.client;



class CD4017Elm extends ChipElm {
    final int FLAG_NUMBERS = 2;
    private int counter; // 0~9
    private boolean lastClock;
    private boolean lastReset;
    private static final int VDD = 0;
    private static final int VSS = 3;
    private static final double MIN_SUPPLY = 3;
    private static final double R_ON = 20;
    private static final double R_OFF = 1e10;
    private static final double R_SUPPLY = 1e6;
    private boolean powered;
    // Trial state is derived from the last accepted time step, never from another
    // Newton iteration. Only stepFinished commits it (also safe on step retries).
    private int nextCounter;
    private boolean nextClock;
    private boolean nextReset;
    private boolean nextPowered;
    
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
        pins[0] = new Pin(0, SIDE_W, usePinNames() ? "VDD" : "16"); // VDD
        pins[1] = new Pin(1, SIDE_W, usePinNames() ? "CLK" : "14"); // CLK
        pins[2] = new Pin(2, SIDE_W, usePinNames() ? "CO" : "12");  // CO
        pins[3] = new Pin(3, SIDE_W, usePinNames() ? "VSS" : "8");  // VSS
        pins[4] = new Pin(4, SIDE_W, usePinNames() ? "INH" : "13"); // inhibit, high active
        pins[5] = new Pin(5, SIDE_W, usePinNames() ? "RESET" : "15");

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
    int getVoltageSourceCount() { return 0; }

    @Override
    boolean nonLinear() { return true; }

    // This chip's logic level comes from VDD/VSS, not the generic editor value.
    // ChipElm still reads/writes the legacy custom-voltage field for dump compatibility.
    @Override
    boolean isDigitalChip() { return false; }

    @Override
    double getThreshold() { return volts[VSS] + getVoltageDiff() / 2; }

    @Override
    void stamp() {
        sim.stampResistor(nodes[VDD], nodes[VSS], R_SUPPLY);
        for (int i = 0; i < getPostCount(); i++) {
            if (isPowerOrOutput(i)) sim.stampNonLinear(nodes[i]);
        }
    }

    @Override
    void execute() {
        boolean wasTrialPowered = nextPowered;
        nextPowered = getVoltageDiff() >= MIN_SUPPLY;
        if (nextPowered != wasTrialPowered) sim.converged = false;
        double threshold = getThreshold();
        for (int i = 0; i < getPostCount(); i++) {
            if (!pins[i].output) pins[i].value = nextPowered && volts[i] > threshold;
        }
        nextClock = pins[1].value;
        nextReset = pins[5].value;
        nextCounter = counter;
        if (!nextPowered || !powered || nextReset) {
            nextCounter = 0;
        } else if (!pins[4].value && !lastClock && nextClock) {
            nextCounter = (counter + 1) % 10;
        }
        // On power-up, sampling nextClock without counting avoids a false edge.
        for (int i = 0; i < 10; i++) {
            setTrialOutput(i + 6, nextPowered && nextCounter == i);
        }
        setTrialOutput(2, nextPowered && nextCounter < 5);
    }

    private void setTrialOutput(int pin, boolean high) {
        if (pins[pin].value != high) sim.converged = false;
        writeOutput(pin, high);
    }

    private double outputResistance(int pin, boolean toVdd) {
        return nextPowered && pins[pin].value == toVdd ? R_ON : R_OFF;
    }

    @Override
    void doStep() {
        execute();
        for (int i = 0; i < getPostCount(); i++) {
            if (!pins[i].output) continue;
            sim.stampResistor(nodes[i], nodes[VDD], outputResistance(i, true));
            sim.stampResistor(nodes[i], nodes[VSS], outputResistance(i, false));
        }
    }

    @Override
    void stepFinished() {
        counter = nextCounter;
        lastClock = nextClock;
        lastReset = nextReset;
        powered = nextPowered;
    }

    @Override
    void calculateCurrent() {
        for (int i = 0; i < getPostCount(); i++) pins[i].current = 0;
        double supplyCurrent = getVoltageDiff() / R_SUPPLY;
        // ChipElm stores current INTO the circuit node, opposite to the bridge's
        // getPostCurrent (positive flowing into the component).
        pins[VDD].current = -supplyCurrent;
        pins[VSS].current = supplyCurrent;
        for (int i = 0; i < getPostCount(); i++) {
            if (!pins[i].output) continue;
            double toVdd = (volts[i] - volts[VDD]) / outputResistance(i, true);
            double toVss = (volts[i] - volts[VSS]) / outputResistance(i, false);
            pins[i].current = -toVdd - toVss;
            pins[VDD].current += toVdd;
            pins[VSS].current += toVss;
        }
        current = -pins[VDD].current;
    }

    @Override
    double getVoltageDiff() { return volts[VDD] - volts[VSS]; }

    @Override
    double getPower() {
        double power = 0;
        for (int i = 0; i < getPostCount(); i++) power -= volts[i] * pins[i].current;
        return power;
    }

    private boolean isPowerOrOutput(int pin) {
        return pin == VDD || pin == VSS || pins[pin].output;
    }

    @Override
    boolean getConnection(int n1, int n2) {
        return n1 != n2 && isPowerOrOutput(n1) && isPowerOrOutput(n2);
    }

    @Override
    boolean hasGroundConnection(int n) {
        return false;
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
        powered = nextPowered = false;
        nextCounter = 0;
        nextClock = nextReset = false;
        calculateCurrent();
    }

    void getInfo(String arr[]) {
        super.getInfo(arr);
        arr[0] = "CD4017 十进制计数器";
        arr[1] = powered ? "计数: " + counter : "未供电 / 欠压：输出高阻";
        arr[2] = "CLK = " + (pins[1].value ? "高" : "低");
        arr[3] = "INH = " + (pins[4].value ? "高" : "低") + " RESET = " + (pins[5].value ? "高" : "低");
        arr[4] = "CO = " + (pins[2].value ? "高" : "低");
        arr[5] = "VDD - VSS = " + getVoltageText(getVoltageDiff());
        arr[6] = "IDD = " + getCurrentText(getCurrent());
        arr[7] = "P = " + getUnitText(getPower(), "W");
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
