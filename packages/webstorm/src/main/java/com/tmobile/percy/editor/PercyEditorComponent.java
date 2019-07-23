/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
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
