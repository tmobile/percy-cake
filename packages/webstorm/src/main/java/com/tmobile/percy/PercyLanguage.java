/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy;

import com.intellij.lang.Language;

/**
 * The percy language.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyLanguage extends Language {

    /**
     * Instance.
     */
    public static final Language INSTANCE = new PercyLanguage();

    /**
     * The language name.
     */
    public static final String LANGUAGE_NAME = "PercyYaml";

    /**
     * Constructor.
     */
    private PercyLanguage() {
        super(LANGUAGE_NAME);
    }
}