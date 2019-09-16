/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy.editor;

import java.awt.Color;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import javax.swing.JComponent;

import org.jetbrains.annotations.Nullable;
import org.w3c.dom.Document;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.intellij.codeHighlighting.BackgroundEditorHighlighter;
import com.intellij.ide.ui.LafManager;
import com.intellij.ide.ui.LafManagerListener;
import com.intellij.openapi.command.WriteCommandAction;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.editor.event.DocumentEvent;
import com.intellij.openapi.editor.event.DocumentListener;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.FileEditorLocation;
import com.intellij.openapi.fileEditor.FileEditorState;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.UserDataHolderBase;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.ui.JBColor;
import com.intellij.util.ui.UIUtil;
import com.tmobile.percy.HttpServer;

import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.embed.swing.JFXPanel;
import javafx.scene.CacheHint;
import javafx.scene.Scene;
import javafx.scene.text.FontSmoothingType;
import javafx.scene.web.WebEngine;
import javafx.scene.web.WebView;
import netscape.javascript.JSObject;

/**
 * The percy editor.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditor extends UserDataHolderBase implements FileEditor {
    static {
        Platform.setImplicitExit(false);
    }

    /**
     * The logger.
     */
    private static final Logger LOG = Logger.getInstance(PercyEditor.class);

    /**
     * The JSON mapper.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * The JavaFX panel.
     */
    private final JFXPanel jfxPanel = new JFXPanel();

    /**
     * The bridge to call java from javascript.
     */
    private final Bridge bridge = new Bridge();

    /**
     * The project.
     */
    private final Project project;

    /**
     * The file to edit.
     */
    private final VirtualFile file;

    /**
     * The web view.
     */
    private WebView webView;

    /**
     * The web view scene.
     */
    private Scene scene;

    /**
     * Whether file is modified.
     */
    private boolean modified;

    /**
     * The listener to setup javascript bridge.
     */
    private final ChangeListener<Document> bridgeListener = (ObservableValue<? extends Document> prop, Document oldDoc,
            Document newDoc) -> {
        JSObject win = (JSObject) webView.getEngine().executeScript("window");
        win.setMember("bridge", bridge);
        jfxPanel.setScene(scene);
    };

    /**
     * The listener to setup look and feel.
     */
    private final LafManagerListener lafListener = (LafManager manager) -> {
        Platform.runLater(() -> {
            setWebStyle();
        });
    };

    /**
     * Constructor.
     *
     * @param project The project
     * @param file    The file to edit
     */
    public PercyEditor(Project project, VirtualFile file) {
        this.project = project;
        this.file = file;
        this.jfxPanel.setBackground(JBColor.background());

        Platform.runLater(() -> {
            // create WebView
            webView = new WebView();
            webView.setContextMenuEnabled(true);
            webView.setCache(true);
            webView.setCacheHint(CacheHint.SPEED);
            webView.fontSmoothingTypeProperty().setValue(FontSmoothingType.GRAY);
            setWebStyle();

            // setup WebEngine
            WebEngine engine = webView.getEngine();
            engine.setJavaScriptEnabled(true);
            engine.documentProperty().addListener(bridgeListener);

            // create scene to display
            Color color = JBColor.background();
            scene = new Scene(webView, javafx.scene.paint.Color.rgb(color.getRed(), color.getGreen(), color.getBlue(),
                    color.getAlpha() / 255.0));

            // load html
            String url = HttpServer.getStaticUrl("index.html");
            LOG.info("Render " + url);
            engine.load(url);
        });

        // Add look and feel listener
        LafManager.getInstance().addLafManagerListener(lafListener);

        // Add document change listener
        com.intellij.openapi.editor.Document document = FileDocumentManager.getInstance().getDocument(file);
        if (document != null) {
            document.addDocumentListener(new DocumentListener() {
                @Override
                public void documentChanged(final DocumentEvent e) {

                    try {
                        if (webView != null) {
                            Map<String, String> send = new HashMap<>();
                            send.put("type", "PercyEditorFileChanged");
                            send.put("fileContent", e.getDocument().getText());
                            sendToJS(send);
                        }
                    } catch (JsonProcessingException e1) {
                        LOG.error(e);
                    }
                }
            }, this);
        }
    }

    /**
     * Set web style.
     */
    private void setWebStyle() {
        if (webView != null) {
            URL url = UIUtil.isUnderDarcula() ? PercyEditor.class.getResource("/darcula.css")
                    : PercyEditor.class.getResource("/default.css");

            webView.getEngine().setUserStyleSheetLocation(url.toExternalForm());
        }
    }

    /**
     * Send message to javascript.
     *
     * @param toSend The message to send
     * @throws JsonProcessingException if JSON error occurs
     */
    private void sendToJS(Object toSend) throws JsonProcessingException {
        String toSendStr = mapper.writeValueAsString(toSend);
        Platform.runLater(() -> {
            JSObject win = (JSObject) webView.getEngine().executeScript("window");
            win.call("sendMessage", toSendStr);
        });
    }

    /**
     * The init message.
     */
    public class InitMessage {
        public String type;
        public boolean editMode;
        public boolean envFileMode;
        public String appName;
        public String fileName;
        public String pathSep;
        public String fileContent;
        public String envFileContent;
        public Map<String, Object> percyConfig = new HashMap<>();
        public Map<String, Object> appPercyConfig = new HashMap<>();
    }

    /**
     * The bridge to call java from javascript.
     */
    public class Bridge {

        /**
         * Post message.
         *
         * @param message The post message received from javascript.
         * @throws IOException if any I/O error occurs
         */
        @SuppressWarnings("unchecked")
        public void postMessage(@Nullable JSObject message) throws IOException {

            String type = message.getMember("type").toString();
            LOG.info(type);

            if ("PercyEditorInit".equalsIgnoreCase(type)) {

                String envFileName = "environments.yaml";
                InitMessage send = new InitMessage();
                send.type = "PercyEditorRender";
                send.editMode = true;
                send.envFileMode = envFileName.equals(file.getName());
                send.appName = file.getParent().getPath();
                send.fileName = file.getName();
                send.pathSep = File.separator;
                send.fileContent = new String(file.contentsToByteArray());

                VirtualFile envFile = file.findFileByRelativePath("../" + envFileName);
                if (envFile != null) {
                    send.envFileContent = new String(envFile.contentsToByteArray());
                }

                send.percyConfig.put("variablePrefix", "_{");
                send.percyConfig.put("variableSuffix", "}_");
                send.percyConfig.put("variableNamePrefix", "$");
                send.percyConfig.put("envVariableName", "env");
                send.percyConfig.put("filenameRegex", "^[a-zA-Z0-9_.-]*$");
                send.percyConfig.put("propertyNameRegex", "^[\\s]*[a-zA-Z0-9$_.-]*[\\s]*$");

                VirtualFile parent = file.getParent();
                while (parent != null) {
                    VirtualFile percyConfigFile = parent.findChild(".percyrc");
                    if (percyConfigFile != null) {
                        Map<String, Object> pmap = send.appPercyConfig;
                        Map<String, Object> nmap = mapper.readValue(new String(percyConfigFile.contentsToByteArray()),
                                Map.class);
                        nmap.putAll(pmap);
                        send.appPercyConfig = nmap;
                    }
                    if (parent.getPath().equals(project.getBasePath())) {
                        break;
                    }
                    parent = parent.getParent();
                }

                sendToJS(send);
            } else if ("PercyEditorSave".equalsIgnoreCase(type)) {
                String fileContent = message.getMember("fileContent").toString();
                LOG.info("Save file: " + file.getCanonicalPath());

                WriteCommandAction.runWriteCommandAction(project, () -> {
                    FileDocumentManager.getInstance().getDocument(file).setText(fileContent);
                });
                Map<String, String> send = new HashMap<>();
                send.put("type", "PercyEditorSaved");
                send.put("fileContent", fileContent);
                send.put("newFileName", file.getName());
                sendToJS(send);
            } else if ("PercyEditorFileDirty".equalsIgnoreCase(type)) {
                modified = Boolean.parseBoolean(message.getMember("dirty").toString());
                LOG.info("modified: " + modified);
            }
        }
    }

    /**
     * Get editor component.
     *
     * @return editor component
     */
    @Override
    public JComponent getComponent() {
        return this.jfxPanel;
    }

    /**
     * Get editor component to focus.
     *
     * @return editor component to focus
     */
    @Override
    public JComponent getPreferredFocusedComponent() {
        return this.jfxPanel;
    }

    /**
     * Get editor name.
     *
     * @return editor name
     */
    @Override
    public String getName() {
        return "Percy Editor";
    }

    /**
     * Get whether file is modified.
     *
     * @return true if file is modified; false otherwise
     */
    @Override
    public boolean isModified() {
        return modified;
    }

    /**
     * Set preferred width/height of web view when editor is deselected.
     */
    @Override
    public void deselectNotify() {
        if (webView != null && scene !=null && scene.getWindow() != null) {
            // get window width/height
            double width = scene.getWindow().getWidth();
            double height = scene.getWindow().getHeight();

            if (width > 0 && height > 0) {
                // set preferred width/height same as window
                if (width != webView.getPrefWidth()) {
                    LOG.info("Prefer window width " + width);
                    webView.setPrefWidth(width);
                }
                if (height != webView.getPrefHeight()) {
                    LOG.info("Prefer window height " + height);
                    webView.setPrefHeight(height);
                }
            }
        }
    }

    /**
     * Dispose this editor.
     */
    @Override
    public void dispose() {
        if (webView != null) {
            webView.getEngine().documentProperty().removeListener(bridgeListener);
        }
        LafManager.getInstance().removeLafManagerListener(lafListener);
    }

    /**
     * Dummy method.
     */
    @Override
    public void selectNotify() {
    }

    /**
     * Dummy method.
     */
    @Override
    public boolean isValid() {
        return true;
    }

    /**
     * Dummy method.
     */
    @Override
    public void setState(FileEditorState state) {
    }

    /**
     * Dummy method.
     */
    @Override
    public void addPropertyChangeListener(PropertyChangeListener listener) {
    }

    /**
     * Dummy method.
     */
    @Override
    public void removePropertyChangeListener(PropertyChangeListener listener) {
    }

    /**
     * Dummy method.
     */
    @Override
    public BackgroundEditorHighlighter getBackgroundHighlighter() {
        return null;
    }

    /**
     * Dummy method.
     */
    @Override
    public FileEditorLocation getCurrentLocation() {
        return null;
    }
}
