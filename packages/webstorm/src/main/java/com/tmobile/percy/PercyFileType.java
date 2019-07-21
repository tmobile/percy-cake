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
package com.tmobile.percy;

import javax.swing.Icon;

import com.intellij.openapi.fileTypes.LanguageFileType;

/**
 * The yaml file type.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyFileType extends LanguageFileType {

    /**
     * Instance.
     */
    public static final PercyFileType INSTANCE = new PercyFileType();

    /**
     * Yaml extensions.
     */
    public static final String[] EXTENSIONS = { "yaml", "yml" };

    /**
     * Constructor.
     */
    private PercyFileType() {
        super(PercyLanguage.INSTANCE);
    }

    /**
     * Get name.
     *
     * @return name
     */
    public String getName() {
        return PercyLanguage.LANGUAGE_NAME;
    }

    /**
     * Get description.
     *
     * @return description
     */
    public String getDescription() {
        return "Percy Yaml";
    }

    /**
     * Get default extension.
     *
     * @return default extension
     */
    public String getDefaultExtension() {
        return EXTENSIONS[0];
    }

    /**
     * Get icon.
     *
     * @return icon
     */
    public Icon getIcon() {
        return null;
    }
}
