package com.lushprojects.circuitjs1.client;

import com.google.gwt.dom.client.Style;
import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.event.dom.client.MouseOutEvent;
import com.google.gwt.event.dom.client.MouseOverEvent;
import com.google.gwt.user.client.ui.*;
import com.lushprojects.circuitjs1.client.util.Locale;

import java.util.HashMap;

public class Toolbar extends HorizontalPanel {

    private Label modeLabel;
    private HashMap<String, Label> highlightableButtons = new HashMap<>();
    private Label activeButton; // Currently active button

    Label resistorButton;

    public Toolbar() {
        // Set the overall style of the toolbar
        setStyleName("toolbar-panel");
        Style style = getElement().getStyle();
        style.setPadding(2, Style.Unit.PX);
        style.setDisplay(Style.Display.FLEX);
        setVerticalAlignment(ALIGN_MIDDLE);
        getElement().getStyle().setBackgroundColor("#1075de");

        add(createIconButton(IconResources.INSTANCE.select().getText(), "Select/Drag", new MyCommand("main", "select")));
        add(createIconButton(IconResources.INSTANCE.undo().getText(), "Undo", new MyCommand("edit", "undo")));
        add(createIconButton(IconResources.INSTANCE.redo().getText(), "Redo", new MyCommand("edit", "redo")));
        add(createIconButton(IconResources.INSTANCE.search().getText(), "Find Component...", new MyCommand("edit", "search")));

        add(createIconButton(IconResources.INSTANCE.wire().getText(), "WireElm"));
        add(resistorButton = createIconButton(IconResources.INSTANCE.resistor().getText(), "ResistorElm"));
        add(createIconButton(IconResources.INSTANCE.led().getText(), "LEDElm"));
        add(createIconButton(IconResources.INSTANCE.ground().getText(), "GroundElm"));
        add(createIconButton(IconResources.INSTANCE.voltage().getText(), "RailElm"));

        String srcInfo[] = { IconResources.INSTANCE.voltage2().getText(), "DCVoltageElm", IconResources.INSTANCE.acSrc().getText(), "ACVoltageElm" };
        add(createButtonSet(srcInfo));
        add(createIconButton(IconResources.INSTANCE.capacitor().getText(), "CapacitorElm"));

        String switchInfo[] = { IconResources.INSTANCE.switchIcon().getText(), "SwitchElm", IconResources.INSTANCE.spdt().getText(), "Switch2Elm", IconResources.INSTANCE.aswitch1().getText(), "AnalogSwitchElm",
                IconResources.INSTANCE.aswitch2().getText(), "AnalogSwitch2Elm" };
        add(createButtonSet(switchInfo));

        String transistorInfo[] = { IconResources.INSTANCE.transistor().getText(), "NTransistorElm", IconResources.INSTANCE.pnpTransistor().getText(), "PTransistorElm" };
        add(createButtonSet(transistorInfo));

        // Spacer to push the mode label to the right
        HorizontalPanel spacer = new HorizontalPanel();
        add(spacer);

        // Create and style the mode label
        modeLabel = new Label("Default Mode");
        modeLabel.addStyleName("toolbar-mode-label");
        styleModeLabel(modeLabel);
        add(modeLabel);
    }

    public void setModeLabel(String text) {
        modeLabel.setText(Locale.LS("Mode: ") + text);
    }

    private Label createIconButton(String icon, String cls) {
        CirSim sim = CirSim.theSim;
        return createIconButton(icon, sim.getLabelTextForClass(cls), new MyCommand("main", cls));
    }

    private Label createIconButton(String iconClass, String tooltip, MyCommand command) {
        // Create a label to hold the icon
        Label iconLabel = new Label();
        iconLabel.addStyleName("toolbar-icon-label"); // Add style for CSS targeting
        iconLabel.setText(""); // No text, just an icon
        if (iconClass.startsWith("<svg"))
            iconLabel.getElement().setInnerHTML(makeSvg(iconClass, 24));
        else
            iconLabel.getElement().addClassName("cirjsicon-" + iconClass);
        iconLabel.setTitle(Locale.LS(tooltip));

        // Style the icon button
        Style style = iconLabel.getElement().getStyle();
        style.setColor("#333");
        style.setMarginRight(5, Style.Unit.PX);
        style.setCursor(Style.Cursor.POINTER);

        // Add hover effect for the button
        iconLabel.addMouseOverHandler(event -> {
            if (iconLabel != activeButton) {
                iconLabel.getElement().getStyle().setColor("black"); // Darken icon on hover
            }
        });
        iconLabel.addMouseOutHandler(event -> {
            if (iconLabel != activeButton) {
                iconLabel.getElement().getStyle().setColor("#333"); // Reset color on mouse out
            }
        });

        // Add a click handler to perform the action
        iconLabel.addClickHandler(new ClickHandler() {
            @Override
            public void onClick(ClickEvent event) {
                // un-highlight
                iconLabel.getElement().getStyle().setColor("#333");
                if (iconLabel == activeButton) {
                    new MyCommand("main", "Select").execute();
                    activeButton = null;
                } else
                    command.execute();
            }
        });

        // Track buttons that belong to the "main" command group
        if (command.getMenuName().equals("main"))
            highlightableButtons.put(command.getItemName(), iconLabel);

        return iconLabel;
    }

    String makeSvg(String s, int size) {
        // Find the end of the opening <svg> tag
        int tagEnd = s.indexOf('>');
        if (tagEnd == -1) {
            return s; // Not a valid SVG
        }

        String svgOpenTag = s.substring(0, tagEnd);
        String originalWidth = "300"; // Default size
        String originalHeight = "300";

        // Extract original width and height to create the viewBox
        try {
            int widthStart = svgOpenTag.indexOf("width=\"");
            if (widthStart != -1) {
                widthStart += "width=\"".length();
                int widthEnd = svgOpenTag.indexOf("\"", widthStart);
                originalWidth = svgOpenTag.substring(widthStart, widthEnd);
            }
            int heightStart = svgOpenTag.indexOf("height=\"");
            if (heightStart != -1) {
                heightStart += "height=\"".length();
                int heightEnd = svgOpenTag.indexOf("\"", heightStart);
                originalHeight = svgOpenTag.substring(heightStart, heightEnd);
            }
        } catch (Exception e) {
            // Fallback to default if parsing fails
        }

        String viewBox = "0 0 " + originalWidth + " " + originalHeight;

        // Remove width and height attributes from the original tag using regex
        String modifiedSvgOpenTag = svgOpenTag.replaceAll("width=\"[^\"]*\"", "")
                                            .replaceAll("height=\"[^\"]*\"", "");

        // Add the new attributes
        String finalSvgOpenTag = modifiedSvgOpenTag + " viewBox='" + viewBox + "' preserveAspectRatio='xMidYMid meet'";

        // Reconstruct the full SVG
        return finalSvgOpenTag + s.substring(tagEnd);
    }

    // New method for creating variant buttons
    private Label createButtonSet(String info[]) {
        MyCommand mainCommand = new MyCommand("main", info[1]);
        CirSim sim = CirSim.theSim;
        Label iconLabel = createIconButton(info[0], sim.getLabelTextForClass(info[1]), mainCommand);

        FlowPanel paletteContainer = new FlowPanel();
        paletteContainer.setVisible(false); // Hidden by default
        paletteContainer.setStyleName("palette-container");

        // Apply CSS styles for positioning and visibility
        Style paletteStyle = paletteContainer.getElement().getStyle();
        paletteStyle.setPosition(Style.Position.ABSOLUTE);
        paletteStyle.setZIndex(1000); // High z-index to appear on top
        paletteStyle.setBackgroundColor("#ffffff");
        paletteStyle.setBorderWidth(1, Style.Unit.PX);
        paletteStyle.setBorderColor("#ccc");
        paletteStyle.setBorderStyle(Style.BorderStyle.SOLID);
        paletteStyle.setPadding(5, Style.Unit.PX);

        int i;
        for (i = 0; i < info.length; i += 2) {
            // Create each variant button
            Label variantButton = new Label();
            variantButton.setText(""); // No text, just an icon
            variantButton.getElement().setInnerHTML(makeSvg(info[i], 40));
            variantButton.setTitle(sim.getLabelTextForClass(info[i + 1]));

            // Style the variant button
            Style variantStyle = variantButton.getElement().getStyle();
            variantStyle.setColor("#333");
            // variantStyle.setPadding(5, Style.Unit.PX);
            variantStyle.setCursor(Style.Cursor.POINTER);

            final MyCommand command = new MyCommand("main", info[i + 1]);
            final String smallSvg = makeSvg(info[i], 24);

            // Add click handler to update the main button and execute the command
            variantButton.addClickHandler(event -> {
                // Change the icon of the main button to reflect the variant selected
                iconLabel.getElement().setInnerHTML(smallSvg);
                highlightableButtons.remove(mainCommand.getItemName());
                highlightableButtons.put(command.getItemName(), iconLabel);
                paletteContainer.setVisible(false);
                mainCommand.setItemName(command.getItemName());
                command.execute(); // Execute the corresponding command for the selected variant
            });

            // Append the variant button to the palette container
            paletteContainer.add(variantButton);
        }

        // Add the palette container to the document (or you could append it to the
        // toolbar directly)
        RootPanel.get().add(paletteContainer);

        // Show palette on mouse-over
        iconLabel.addMouseOverHandler(event -> {
            paletteContainer.setVisible(true);

            // Position the palette relative to the icon label
            int leftOffset = iconLabel.getAbsoluteLeft() - 12;
            int topOffset = iconLabel.getAbsoluteTop() + iconLabel.getOffsetHeight() - 2;
            paletteContainer.getElement().getStyle().setLeft(leftOffset, Style.Unit.PX);
            paletteContainer.getElement().getStyle().setTop(topOffset, Style.Unit.PX);
        });

        // Hide palette on mouse-out
        iconLabel.addMouseOutHandler(event -> {
            paletteContainer.setVisible(false);
        });

        // Keep the palette visible when hovering over it
        paletteContainer.addDomHandler(event -> paletteContainer.setVisible(true), MouseOverEvent.getType());
        paletteContainer.addDomHandler(event -> {
            paletteContainer.setVisible(false);
        }, MouseOutEvent.getType());

        return iconLabel;
    }

    private void styleModeLabel(Label label) {
        Style style = label.getElement().getStyle();
        style.setFontSize(16, Style.Unit.PX);
        style.setColor("white"); //mode文字颜色
        style.setPaddingRight(10, Style.Unit.PX);
        style.setProperty("whiteSpace", "nowrap");
    }

    public void highlightButton(String key) {
        // Deactivate the currently active button
        if (activeButton != null) {
            activeButton.getElement().getStyle().setColor("#333"); // Reset color
            activeButton.getElement().getStyle().setBackgroundColor(null);
        }

        // Activate the new button
        Label buttonToActivate = highlightableButtons.get(key);
        if (buttonToActivate != null) {
            buttonToActivate.getElement().getStyle().setColor("black"); // Set selected color to black
            buttonToActivate.getElement().getStyle().setBackgroundColor(null); // Ensure no background color
            activeButton = buttonToActivate;
        } else {
            activeButton = null;
        }
    }

    public void setEuroResistors(boolean euro) {
        String icon = euro ? IconResources.INSTANCE.euroResistor().getText() : IconResources.INSTANCE.resistor().getText();
        resistorButton.getElement().setInnerHTML(makeSvg(icon, 24));
    }

    final String wireIcon = "<svg><g transform='scale(0.208) translate(7.5, 32)'>"
            + "<line x1='5' y1='45' x2='95' y2='5' stroke='currentColor' stroke-width='8' /> "
            + "<circle cx='5' cy='45' r='10' fill='currentColor' /><circle cx='95' cy='5' r='10' fill='currentColor' /> "
            + "</g></svg>";


    final String voltage2Icon = "<svg><defs /><g transform='scale(.8) translate(-122.00,-53.00) scale(0.500000)'><path fill='none' stroke='currentColor' d=' M 272 160 L 272 140' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 132 L 272 112' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 262 140 L 282 140' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 256 132 L 288 132' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 275 160 A 3 3 0 1 1 274.99973922528994 159.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 275 112 A 3 3 0 1 1 274.99973922528994 111.96044522459944 Z' /></g></svg>";


    final String pnpTransistorIcon = "<svg><defs /><g transform='translate(-116.27,-90.40) scale(0.533333)'><path fill='none' stroke='currentColor' d=' M 256 208 L 243 198' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 256 176 L 243 186' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 245 187 L 253 184 L 248 178 Z' /><path fill='none' stroke='currentColor' d=' M 224 192 L 240 192' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 240 176 L 243 176 L 243 208 L 240 208 Z' /><path fill='currentColor' stroke='currentColor' d=' M 227 192 A 3 3 0 1 1 226.99973922528991 191.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 259 208 A 3 3 0 1 1 258.99973922528994 207.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 259 176 A 3 3 0 1 1 258.99973922528994 175.96044522459943 Z' /></g></svg>";
    final String fetIcon = "<svg><defs /><g transform='translate(-68.92,-50.27) scale(0.324324)'><path fill='none' stroke='currentColor' d=' M 272 208 L 250 208' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 176 L 250 176' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 208 L 250 203' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 197 L 250 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 192 L 250 187' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 181 L 250 176' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 208 L 250 213' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 176 L 250 171' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 208 L 272 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 192 L 250 192' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 250 192 L 262 197 L 262 187 Z' /><path fill='none' stroke='currentColor' d=' M 224 192 L 244 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 244 184 L 244 200' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 176 L 272 160' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 208 L 272 224' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 227 192 A 3 3 0 1 1 226.99973922528991 191.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 275 160 A 3 3 0 1 1 274.99973922528994 159.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 275 224 A 3 3 0 1 1 274.99973922528994 223.96044522459943 Z' /></g></svg>";
    final String fetIcon2 = "<svg><defs /><g transform='translate(-68.92,-50.27) scale(0.324324)'><path fill='none' stroke='currentColor' d=' M 272 176 L 272 160' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 208 L 272 224' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 208 L 250 208' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 176 L 250 176' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 208 L 250 203' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 197 L 250 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 192 L 250 187' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 181 L 250 176' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 208 L 250 213' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 250 176 L 250 171' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 176 L 272 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 272 192 L 250 192' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 272 192 L 260 187 L 260 197 Z' /><path fill='none' stroke='currentColor' d=' M 224 192 L 244 192' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 244 184 L 244 200' stroke-linecap='round' stroke-width='3' /><path fill='currentColor' stroke='currentColor' d=' M 275 160 A 3 3 0 1 1 274.99973922528994 159.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 275 224 A 3 3 0 1 1 274.99973922528994 223.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 227 192 A 3 3 0 1 1 226.99973922528991 191.96044522459943 Z' /></g></svg>";

    final String inductIcon = "<svg><g transform='translate(-101.59,-58.18) scale(0.405680)'><path fill='none' stroke='currentColor' d=' M 256 176 L 264 176' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 296 176 L 304 176' stroke-linecap='round' stroke-width='3' /><g transform='matrix(1,0,0,1,264,176) scale(1,1)'><path fill='none' stroke='currentColor' d=' M 0 0 L 0 6.53144959545255e-16 A 5.333333333333333 5.333333333333333 0 0 1 10.666666666666666 0 L 10.666666666666666 0' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 10.666666666666666 0 L 10.666666666666668 6.53144959545255e-16 A 5.333333333333333 5.333333333333333 0 0 1 21.333333333333332 0 L 21.333333333333332 0' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 21.333333333333332 0 L 21.333333333333336 6.53144959545255e-16 A 5.333333333333333 5.333333333333333 0 0 1 32 0 L 32 0' stroke-linecap='round' stroke-width='3' /></g><path fill='currentColor' stroke='currentColor' d=' M 259 176 A 3 3 0 1 1 258.99973922528994 175.96044522459943 Z' /><path fill='currentColor' stroke='currentColor' d=' M 307 176 A 3 3 0 1 1 306.99973922528994 175.96044522459943 Z' /></g></svg>";



    final String andIcon = "<svg><g transform='translate(-143.64,-130.55) scale(0.363636)'><path fill='none' stroke='currentColor' d=' M 400 400 L 414 400' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 400 384 L 414 384' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 442 392 L 456 392' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 414 378 L 428 378 A 14 14 0 0 1 428 406 L 414 406 Z' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String orIcon = "<svg><g transform='translate(-143.64,-153.82) scale(0.363636)'><path fill='none' stroke='currentColor' d=' M 400 464 L 414 464' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 400 448 L 414 448' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 442 456 L 456 456' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 413 442 L 422 442 C 434 445 434 445 442 456 C 434 467 434 467 422 470 L 413 470 C 416 456 416 456 413 442 Z' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String xorIcon = "<svg><g transform='translate(-143.64,-180.00) scale(0.363636)'><path fill='none' stroke='currentColor' d=' M 400 536 L 414 536' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 400 520 L 414 520' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 442 528 L 456 528' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 413 514 L 422 514 C 434 517 434 517 442 528 C 434 539 434 539 422 542 L 413 542 C 416 528 416 528 413 514 Z M 408 514 C 411 528 411 528 408 542' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String nandIcon = "<svg><g transform='translate(-143.64,-142.18) scale(0.363636)'><path fill='none' stroke='currentColor' d=' M 400 432 L 414 432' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 400 416 L 414 416' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 450 424 L 456 424' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 414 410 L 428 410 A 14 14 0 0 1 428 438 L 414 438 Z' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 448.94 424 A 2.94 2.94 0 1 1 448.93999853000014 423.99706000049' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String norIcon = "<svg><g transform='translate(-143.64,-165.45) scale(0.363636)'><path fill='none' stroke='currentColor' d=' M 400 496 L 414 496' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 400 480 L 414 480' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 450 488 L 456 488' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 413 474 L 422 474 C 434 477 434 477 442 488 C 434 499 434 499 422 502 L 413 502 C 416 488 416 488 413 474 Z' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 448.94 488 A 2.94 2.94 0 1 1 448.93999853000014 487.99706000049' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String inverterIcon = "<svg><g transform='translate(-288.41,-166.76) scale(0.413793)'><path fill='none' stroke='currentColor' d=' M 704 432 L 712 432' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 746 432 L 752 432' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 712 416 L 712 448 L 739 432 Z' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 744.94 432 A 2.94 2.94 0 1 1 744.9399985300001 431.99706000049' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String aswitch1Icon = "<svg><g transform='translate(-242.27,-122.92) scale(0.324324)'><path fill='none' stroke='currentColor' d=' M 752 416 L 768 416' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 800 416 L 816 416' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 768 416 L 800 400' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 784 432 L 784 424' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String aswitch2Icon = "<svg><g transform='translate(-237.08,-146.27) scale(0.324324)'><path fill='none' stroke='currentColor' d=' M 736 480 L 752 480' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 784 496 L 800 496' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 784 464 L 800 464' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 752 480 L 784 464' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 768 496 L 768 512' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String dpdtIcon = "<svg><g transform='translate(-205.60,-130.93) scale(0.266667)'><path fill='none' stroke='currentColor' d=' M 784 512 L 800 512' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 848 528 L 832 528' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 848 496 L 832 496' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 816 520 L 816 557' stroke-linecap='round' /><path fill='none' stroke='currentColor' d=' M 800 512 L 832 528' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 784 560 L 800 560' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 848 576 L 832 576' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 848 544 L 832 544' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 800 560 L 832 576' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String spdtIcon = "<svg><g transform='translate(-242.27,-143.68) scale(0.324324)'><path fill='none' stroke='currentColor' d=' M 752 480 L 768 480' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 800 464 L 816 464' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 800 496 L 816 496' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 768 480 L 800 464' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String acSrcIcon = "<svg><g transform='translate(-104.09,-66.93) scale(0.266667)'><path fill='none' stroke='currentColor' d=' M 432 336 L 432 313' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 432 279 L 432 256' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 448.66 296 A 16.66 16.66 0 1 1 448.6599916700007 295.98334000277663' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 422 296 L 423 294 L 424 292 L 425 290 L 426 289 L 427 289 L 428 289 L 429 290 L 430 292 L 431 294 L 432 296 L 433 298 L 434 300 L 435 302 L 436 303 L 437 303 L 438 303 L 439 302 L 440 300 L 441 298 L 442 296' stroke-linecap='round' stroke-width='3' /></g></svg>";
    final String opAmpTopIcon = "<svg><g transform='translate(-169.33,-86.13) scale(0.266667)'><path fill='none' stroke='currentColor' d=' M 640 384 L 654 384' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 640 352 L 654 352' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 706 368 L 720 368' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 654 400 L 654 336 L 706 368 Z' stroke-linecap='round' stroke-width='3' /><g><text fill='currentColor' stroke='currentColor' font-family='sans-serif' font-size='14px' font-style='normal' font-weight='normal' text-decoration='normal' x='664' y='382' text-anchor='middle' dominant-baseline='central'>-</text></g><g><text fill='currentColor' stroke='currentColor' font-family='sans-serif' font-size='14px' font-style='normal' font-weight='normal' text-decoration='normal' x='664' y='352' text-anchor='middle' dominant-baseline='central'>+</text></g></g></svg>";
    final String opAmpBotIcon = "<svg><g transform='translate(-169.33,-86.13) scale(0.266667)'><path fill='none' stroke='currentColor' d=' M 640 352 L 654 352' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 640 384 L 654 384' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 706 368 L 720 368' stroke-linecap='round' stroke-width='3' /><path fill='none' stroke='currentColor' d=' M 654 336 L 654 400 L 706 368 Z' stroke-linecap='round' stroke-width='3' /><g><text fill='currentColor' stroke='currentColor' font-family='sans-serif' font-size='14px' font-style='normal' font-weight='normal' text-decoration='normal' x='664' y='350' text-anchor='middle' dominant-baseline='central'>-</text></g><g><text fill='currentColor' stroke='currentColor' font-family='sans-serif' font-size='14px' font-style='normal' font-weight='normal' text-decoration='normal' x='664' y='384' text-anchor='middle' dominant-baseline='central'>+</text></g></g></svg>";

}
