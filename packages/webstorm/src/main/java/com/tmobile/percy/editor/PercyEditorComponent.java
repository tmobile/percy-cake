/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy.editor;

import java.io.IOException;
import java.io.InputStream;

import com.intellij.openapi.components.ApplicationComponent;
import com.intellij.openapi.util.io.FileUtilRt;
import com.teamdev.jxbrowser.engine.Engine;
import com.teamdev.jxbrowser.engine.EngineOptions;
import com.teamdev.jxbrowser.engine.RenderingMode;

/**
 * The percy editor component.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditorComponent implements ApplicationComponent {

    /**
     * The jxbrowser engine.
     */
    public static final Engine engine;

    static {
        try (InputStream inputStream = PercyEditorComponent.class.getResourceAsStream("/license")) {
            // load license
            System.setProperty("jxbrowser.license.key", new String(FileUtilRt.loadBytes(inputStream)).trim());

            // Create engine
            engine = Engine.newInstance(
                    EngineOptions.newBuilder(RenderingMode.HARDWARE_ACCELERATED).enableIncognito().build());
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Dispose component.
     */
    @Override
    public void disposeComponent() {
        engine.close();
    }
}
