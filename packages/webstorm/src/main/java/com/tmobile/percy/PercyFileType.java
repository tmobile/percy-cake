/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
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
