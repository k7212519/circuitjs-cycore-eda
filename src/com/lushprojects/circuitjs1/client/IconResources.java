package com.lushprojects.circuitjs1.client;

import com.google.gwt.core.client.GWT;
import com.google.gwt.resources.client.ClientBundle;
import com.google.gwt.resources.client.TextResource;

/**
 * A ClientBundle for accessing SVG icons as TextResources.
 * This allows SVG content to be loaded from files at compile time.
 */
public interface IconResources extends ClientBundle {
    
    // 静态方法用于处理SVG内容
    public static String makeSvg(String s, int size) {
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
        String finalSvgOpenTag = modifiedSvgOpenTag + " width=\"" + size + "px\" height=\"" + size + "px\" viewBox='" + viewBox + "' preserveAspectRatio='xMidYMid meet'";

        // Reconstruct the full SVG
        return finalSvgOpenTag + s.substring(tagEnd);
    }
    IconResources INSTANCE = GWT.create(IconResources.class);

    @Source("../public/img/svg/select.svg")
    TextResource select();

    @Source("../public/img/svg/cance.svg")
    TextResource cance();

    @Source("../public/img/svg/gnd.svg")
    TextResource ground();

    @Source("../public/img/svg/cap.svg")
    TextResource capacitor();

    @Source("../public/img/svg/switch.svg")
    TextResource switchIcon();

    @Source("../public/img/svg/transistor.svg")
    TextResource transistor();

    @Source("../public/img/svg/led.svg")
    TextResource led();

    @Source("../public/img/svg/resistor.svg")
    TextResource resistor();

    @Source("../public/img/svg/euro-resistor.svg")
    TextResource euroResistor();

    @Source("../public/img/svg/vcc.svg")
    TextResource voltage();

    @Source("../public/img/svg/wire.svg")
    TextResource wire();

    @Source("../public/img/svg/ccw.svg")
    TextResource undo();

    @Source("../public/img/svg/cw.svg")
    TextResource redo();

    @Source("../public/img/svg/search.svg")
    TextResource search();

    @Source("../public/img/svg/volt.svg")
    TextResource voltage2();

    @Source("../public/img/svg/ac-src.svg")
    TextResource acSrc();

    @Source("../public/img/svg/spdt.svg")
    TextResource spdt();

    @Source("../public/img/svg/aswitch1.svg")
    TextResource aswitch1();

    @Source("../public/img/svg/aswitch2.svg")
    TextResource aswitch2();

    @Source("../public/img/svg/pnp.svg")
    TextResource pnpTransistor();

    @Source("../public/img/svg/play.svg")
    TextResource play();

    @Source("../public/img/svg/pause.svg")
    TextResource pause();

    @Source("../public/img/svg/reset.svg")
    TextResource reset();

}
