/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy;

import com.intellij.openapi.fileTypes.FileTypeConsumer;
import com.intellij.openapi.fileTypes.FileTypeFactory;

/**
 * The yaml file type factory.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyFileTypeFactory extends FileTypeFactory {

    /**
     * Create file type.
     *
     * @param fileTypeConsumer The file type consumer
     */
    @Override
    public void createFileTypes(FileTypeConsumer fileTypeConsumer) {
        fileTypeConsumer.consume(PercyFileType.INSTANCE,
                String.join(FileTypeConsumer.EXTENSION_DELIMITER, PercyFileType.EXTENSIONS));
    }
}
