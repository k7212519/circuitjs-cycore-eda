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

import com.google.gwt.canvas.client.Canvas;
import com.google.gwt.user.client.ui.Composite;
import com.google.gwt.user.client.ui.VerticalPanel;
import com.google.gwt.canvas.dom.client.Context2d;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.MouseDownHandler;
import com.google.gwt.event.dom.client.MouseDownEvent;
import com.google.gwt.event.dom.client.MouseMoveHandler;
import com.google.gwt.event.dom.client.MouseMoveEvent;
import com.google.gwt.event.dom.client.MouseUpHandler;
import com.google.gwt.event.dom.client.MouseUpEvent;
import com.google.gwt.event.dom.client.MouseOutEvent;
import com.google.gwt.event.dom.client.MouseOutHandler;
import com.google.gwt.event.dom.client.MouseOverEvent;
import com.google.gwt.event.dom.client.MouseOverHandler;
import com.google.gwt.user.client.Command;
import com.google.gwt.user.client.Event;
import com.google.gwt.dom.client.NativeEvent;
import com.google.gwt.dom.client.Touch;
import com.google.gwt.event.dom.client.MouseWheelEvent;
import com.google.gwt.event.dom.client.MouseWheelHandler;
import com.google.gwt.event.dom.client.TouchCancelEvent;
import com.google.gwt.event.dom.client.TouchCancelHandler;
import com.google.gwt.event.dom.client.TouchEndEvent;
import com.google.gwt.event.dom.client.TouchEndHandler;
import com.google.gwt.event.dom.client.TouchMoveEvent;
import com.google.gwt.event.dom.client.TouchMoveHandler;
import com.google.gwt.event.dom.client.TouchStartEvent;
import com.google.gwt.event.dom.client.TouchStartHandler;


public class Scrollbar extends  Composite implements 
	ClickHandler, MouseDownHandler, MouseMoveHandler, MouseUpHandler, MouseOutHandler, MouseOverHandler,
	MouseWheelHandler, TouchStartHandler, TouchCancelHandler, TouchEndHandler, TouchMoveHandler {
	
	static int HORIZONTAL =1;
	static int HMARGIN=2; // 保持小边距
	static int SCROLLHEIGHT=20; // 大幅增加滑条容器高度
	static int BARWIDTH=3;
	static int BARMARGIN=3;

	Canvas can;
	VerticalPanel pan;
	Context2d g;
	int min;
	int max;
	int val;
	boolean dragging=false;
	boolean enabled=true;
	Command command=null;
	CircuitElm attachedElm=null;
	
	public Scrollbar(int orientation, int value, int visible, int minimum, int maximum) {
		min=minimum;
		max=maximum-1;
		val=value;
		 pan = new VerticalPanel();
		can = Canvas.createIfSupported();
		// 设置Canvas宽度为容器宽度的90%
		int canvasWidth = (int)(CirSim.VERTICALPANELWIDTH * 0.9);
		can.setWidth(canvasWidth + " px");
		can.setHeight("50 px"); // 增加显示高度
		can.setCoordinateSpaceWidth(canvasWidth);
		can.setCoordinateSpaceHeight(SCROLLHEIGHT);
		// 设置滑块容器水平居中
		pan.setHorizontalAlignment(VerticalPanel.ALIGN_CENTER);
		pan.add(can);
		g=can.getContext2d();
		can.addClickHandler( this);
		can.addMouseDownHandler(this);
		can.addMouseUpHandler(this);
		can.addMouseMoveHandler(this);
		can.addMouseOutHandler(this);
		can.addMouseOverHandler(this);
		can.addMouseWheelHandler(this);
		
		// our hack from CirSim doesn't work here so we have to handle touch events explicitly
		can.addTouchStartHandler(this);
		can.addTouchMoveHandler(this);
		can.addTouchEndHandler(this);
		can.addTouchCancelHandler(this);
		
		this.draw();
		initWidget(pan);
	}
	
	public Scrollbar(int orientation, int value, int visible, int minimum, int maximum, 
			Command cmd, CircuitElm e) {
		this(orientation,value,visible,minimum,maximum);
		this.command=cmd;
		attachedElm=e;
	}
	
	public Scrollbar(int orientation, int value, int visible, int minimum, int maximum, Command cmd) {
		this(orientation, value, visible, minimum, maximum);
		this.command=cmd;
	}
	
	void draw() {
		// 获取Canvas的实际宽度
		int canvasWidth = can.getCoordinateSpaceWidth();
		
		// 清空画布背景，使用透明色
		g.clearRect(0, 0, canvasWidth, SCROLLHEIGHT);
		
		// 定义滑块条的参数
		int yCenter = SCROLLHEIGHT / 2;
		int barHeight = 8; // 增加滑块条高度
		int radius = barHeight / 2; // 圆角半径
		
		// 计算滑块位置
		double p = HMARGIN + ((canvasWidth-2*HMARGIN)*((double)(val-min)))/(max-min);
		
		// 绘制灰色背景滑块条（带圆角）
		if (enabled)
			g.setFillStyle("grey");
		else
			g.setFillStyle("lightgrey");
			
		// 绘制主体矩形部分
		g.fillRect(HMARGIN + radius, yCenter - radius, canvasWidth - 2*HMARGIN - 2*radius, barHeight);
		
		// 绘制左圆角
		g.beginPath();
		g.arc(HMARGIN + radius, yCenter, radius, 0, 2 * Math.PI, false);
		g.fill();
		
		// 绘制右圆角
		g.beginPath();
		g.arc(canvasWidth - HMARGIN - radius, yCenter, radius, 0, 2 * Math.PI, false);
		g.fill();
		
		// 绘制彩色已滑动部分（带圆角）
		if (enabled && p > HMARGIN) {
			if (attachedElm != null && attachedElm.needsHighlight())
				g.setFillStyle(CircuitElm.selectColor.getHexValue());
			else
				g.setFillStyle("#FF6E6E");
			
			// 只绘制到滑块位置
			double fillWidth = p - HMARGIN;
			
			// 如果宽度大于直径，绘制矩形部分
			if (fillWidth > 2 * radius) {
				g.fillRect(HMARGIN + radius, yCenter - radius, fillWidth - 2*radius, barHeight);
				
				// 绘制左圆角
				g.beginPath();
				g.arc(HMARGIN + radius, yCenter, radius, 0, 2 * Math.PI, false);
				g.fill();
				
				// 如果滑块未到最右端，则绘制右边的半圆
				if (p < canvasWidth - HMARGIN) {
					g.beginPath();
					g.arc(p, yCenter, radius, 0, 2 * Math.PI, false);
					g.fill();
				}
			} else {
				// 宽度很小时只绘制部分圆形
				g.beginPath();
				g.arc(HMARGIN + radius, yCenter, radius, 0, 2 * Math.PI, false);
				g.fill();
			}
		}
		
		// 绘制滑块指示器 - 圆角滑块，尺寸更大
		g.setFillStyle("#105DAD");
		// 移除所有描边，避免产生阴影效果
		
		int indicatorWidth = 10; // 进一步增大宽度，与新的高度保持比例
		int indicatorHeight = SCROLLHEIGHT; // 最大化高度，占据整个滑块区域
		int cornerRadius = Math.min(indicatorWidth / 2, indicatorHeight / 2); // 圆角半径取宽高一半的较小值
		
		// 调整滑块位置，确保在两端时不会超出边界
		int x;
		if (val == min) {
			// 在最小值位置，滑块左侧与滑条左侧对齐
			x = HMARGIN;
		} else if (val == max) {
			// 在最大值位置，滑块右侧与滑条右侧对齐
			x = canvasWidth - HMARGIN - indicatorWidth;
		} else {
			// 正常位置，根据比例计算
			x = (int)(p - indicatorWidth/2);
			
			// 确保滑块不会超出左右边界
			if (x < HMARGIN) {
				x = HMARGIN;
			} else if (x + indicatorWidth > canvasWidth - HMARGIN) {
				x = canvasWidth - HMARGIN - indicatorWidth;
			}
		}
		
		int y = 0; // 从顶部开始，占满整个高度
		
		// 绘制放大后的圆角滑块
		// 由于滑块现在占满整个高度，我们需要采用不同的绘制方法
		
		// 使用路径绘制整个圆角矩形
		g.beginPath();
		// 开始绘制左上角圆弧
		g.arc(x + cornerRadius, y + cornerRadius, cornerRadius, Math.PI, 1.5 * Math.PI, false);
		// 绘制顶部线
		g.lineTo(x + indicatorWidth - cornerRadius, y);
		// 绘制右上角圆弧
		g.arc(x + indicatorWidth - cornerRadius, y + cornerRadius, cornerRadius, 1.5 * Math.PI, 0, false);
		// 绘制右侧线
		g.lineTo(x + indicatorWidth, y + indicatorHeight - cornerRadius);
		// 绘制右下角圆弧
		g.arc(x + indicatorWidth - cornerRadius, y + indicatorHeight - cornerRadius, cornerRadius, 0, 0.5 * Math.PI, false);
		// 绘制底部线
		g.lineTo(x + cornerRadius, y + indicatorHeight);
		// 绘制左下角圆弧
		g.arc(x + cornerRadius, y + indicatorHeight - cornerRadius, cornerRadius, 0.5 * Math.PI, Math.PI, false);
		// 闭合路径
		g.closePath();
		// 填充整个路径
		g.fill();
		// 不添加任何描边，确保没有阴影效果
	}
	
	int calcValueFromPos(int x){
		int v;
		// 获取Canvas的实际宽度
		int canvasWidth = can.getCoordinateSpaceWidth();
		
		// 计算滑块指示器宽度
		int indicatorWidth = 10;
		
		// 为滑块指示器的宽度保留空间，调整滑块条的有效宽度
		int effectiveWidth = canvasWidth - 2*HMARGIN;
		
		// 限制点击位置在有效范围内
		if (x < HMARGIN) {
			x = HMARGIN;
		} else if (x > canvasWidth - HMARGIN) {
			x = canvasWidth - HMARGIN;
		}
		
		// 根据点击位置计算值
		v = min + (max-min) * (x-HMARGIN) / effectiveWidth;
		
		// 确保值在范围内
		if (v < min)
			v = min;
		if (v > max)
			v = max;
			
		return v;
	}
	
	public void onMouseDown(MouseDownEvent e){
//		GWT.log("Down");
		dragging=false;
		e.preventDefault();
		doMouseDown(e.getX(), true);
	}
	
	void doMouseDown(int x, boolean mouse) {
	    if (enabled){
		// 去掉左右箭头区域的点击处理
		val=calcValueFromPos(x);	
		dragging=true;
		
		// setCapture doesn't work on touch for some reason; touchend/touchmoved events
		// don't get sent
		if (mouse)
		    Event.setCapture(can.getElement());
		draw();
		if (command!=null)
		    command.execute();
	    }
	}
	
	native boolean noButtonsDown(NativeEvent e) /*-{
	    return e.buttons == 0;
	}-*/;
	
	public void onMouseMove(MouseMoveEvent e){
//		GWT.log("Move");
		e.preventDefault();
		
		// we don't always get the mouse up event so make sure the button is still down
		if (dragging && noButtonsDown(e.getNativeEvent())) {
		    Event.releaseCapture(can.getElement());
		    dragging = false;
		    return;
		}
		doMouseMove(e.getX());
	}
	
	void doMouseMove(int x) {
	    if (enabled) {
		if (dragging) {
		    val=calcValueFromPos(x);	
		    draw();
		    if (command!=null)
			command.execute();
		}
	    }
	}
	
	public void onMouseUp(MouseUpEvent e){
//		GWT.log("Up");
		e.preventDefault();
		Event.releaseCapture(can.getElement());
		if (enabled && dragging) {
			val=calcValueFromPos(e.getX());	
			dragging=false;
			draw();
			if (command!=null)
				command.execute();
		}
	}
	
	public void onMouseOut(MouseOutEvent e){
//		GWT.log("Out");
//		e.preventDefault();
	    	if (dragging)
	    	    return;
		if (enabled && attachedElm!=null && attachedElm.isMouseElm())
			CircuitElm.sim.setMouseElm(null);
	}
	
	public void onMouseOver(MouseOverEvent e){
		
		if (enabled && attachedElm!=null)
			 CircuitElm.sim.setMouseElm(attachedElm);
	}
	
	public void onMouseWheel(MouseWheelEvent e) {
		e.preventDefault();
		if (enabled)
			setValue(val+e.getDeltaY()/3);
	}
	
	public void onClick(ClickEvent e) {
//		GWT.log("Click");
		e.preventDefault();
//		if (e.getX()<HMARGIN+SCROLLHEIGHT ) {
//			if (val>min)
//				val--;
//		}
//		else {
//			if (e.getX()>CirSim.VERTICALPANELWIDTH-HMARGIN-SCROLLHEIGHT ) {
//				if (val<max)
//					val++;
//			}
//			else {
//				val=calcValueFromPos(e.getX());			}
//		}
//		draw();
		
	}
	
	public int getValue(){
		return val;
	}
	
	public void setValue(int i){
		if (i<min)
			i=min;
		else if (i>max)
			i=max;
		val =i;
		draw();
		if (command!=null)
			command.execute();
	}
	
	public void enable() {
		enabled=true;
		draw();
	}
	
	public void disable() {
		enabled=false;
		dragging=false;
		draw();
	}

	public void onTouchMove(TouchMoveEvent e) {
//	    GWT.log("touchmove");
	    e.preventDefault();
	    Touch t = e.getTouches().get(0);
	    doMouseMove(t.getRelativeX(getElement()));
	}

	public void onTouchEnd(TouchEndEvent event) {
//	    GWT.log("touchend");;
	    event.preventDefault();
	    if (enabled && dragging) {
		dragging=false;
		draw();
		if (command!=null)
		    command.execute();
	    }
	}

	public void onTouchCancel(TouchCancelEvent event) {
//	    GWT.log("touchcancel");;
	    event.preventDefault();
	    dragging = false;
	}

	public void onTouchStart(TouchStartEvent event) {
//	    GWT.log("touchstart");
	    event.preventDefault();
	    dragging=false;
	    Touch t = event.getTouches().get(0);
	    doMouseDown(t.getRelativeX(getElement()), false);
	}
	
}
