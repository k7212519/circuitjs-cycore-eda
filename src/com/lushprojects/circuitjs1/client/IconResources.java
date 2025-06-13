package com.lushprojects.circuitjs1.client;

import com.google.gwt.core.client.GWT;
import com.google.gwt.resources.client.ClientBundle;
import com.google.gwt.resources.client.TextResource;

/**
 * A ClientBundle for accessing SVG icons as TextResources.
 * This allows SVG content to be loaded from files at compile time.
 */
public interface IconResources extends ClientBundle {
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

}
