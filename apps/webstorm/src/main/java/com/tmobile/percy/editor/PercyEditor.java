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

import org.json.JSONObject;
import org.jetbrains.annotations.Nullable;
import org.w3c.dom.Document;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.intellij.codeHighlighting.BackgroundEditorHighlighter;
import com.intellij.openapi.application.ApplicationManager;
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
import com.intellij.openapi.util.Disposer;
import com.intellij.ui.JBColor;
import com.intellij.ui.jcef.JBCefBrowser;
import com.intellij.ui.jcef.JBCefJSQuery;
import com.intellij.util.ui.UIUtil;
import com.intellij.util.messages.MessageBusConnection;
import com.intellij.ide.ui.LafManagerListener;
import com.tmobile.percy.HttpServer;

import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.handler.CefDisplayHandlerAdapter;
import org.cef.handler.CefLoadHandler;
import org.cef.handler.CefLoadHandlerAdapter;

/**
 * The percy editor.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class PercyEditor extends UserDataHolderBase implements FileEditor {

    /**
     * The logger.
     */
    private static final Logger LOG = Logger.getInstance(PercyEditor.class);

    /**
     * The JSON mapper.
     */
    private static final ObjectMapper mapper = new ObjectMapper();

    /**
     * The JBCefBrowser instance.
     */
    private final JBCefBrowser myJBCefBrowser;

    /**
     * The JBCefJSQuery instance.
     */
    private final JBCefJSQuery myJSQuerySendMessage;

    /**
     * The browser instance.
     */
    private final JComponent browser;

    /**
     * The CefLoadHandler instance.
     */
    private final CefLoadHandler myCefLoadHandler;

    /**
     * The BridgeSettingListener instance.
     */
    private final BridgeSettingListener myBridgeSettingListener = new BridgeSettingListener();

   /**
    * The Message Bus Connection instance
    */
    private final MessageBusConnection messageBusConnection = ApplicationManager.getApplication().getMessageBus().connect();

    /**
     * The project.
     */
    private final Project project;

    /**
     * The file to edit.
     */
    private final VirtualFile file;

    /**
     * Whether file is modified.
     */
    private boolean modified;

    /**
     * The BridgeSettingListener
     */
    private class BridgeSettingListener extends CefLoadHandlerAdapter {
        @Override
        public void onLoadingStateChange(CefBrowser browser, boolean isLoading, boolean canGoBack, boolean canGoForward) {
            myJBCefBrowser.getCefBrowser().executeJavaScript(
                "window.bridge = { postMessage : function(message) { var messageString = JSON.stringify(message);" + myJSQuerySendMessage.inject("messageString") + " }};",
                myJBCefBrowser.getCefBrowser().getURL(), 0);
            setWebStyle();
        }
    }

    /**
     * Constructor.
     *
     * @param project The project
     * @param file    The file to edit
     */
    public PercyEditor(Project project, VirtualFile file) {
        this.project = project;
        this.file = file;

        String url = HttpServer.getStaticUrl("index.html");
        LOG.info("Render " + url);

        myJBCefBrowser = new JBCefBrowser(url);

        myJBCefBrowser.getJBCefClient().addLoadHandler(myCefLoadHandler = new CefLoadHandlerAdapter() {
            @Override
            public void onLoadingStateChange(CefBrowser browser, boolean isLoading, boolean canGoBack, boolean canGoForward) {
                myBridgeSettingListener.onLoadingStateChange(browser, isLoading, canGoBack, canGoForward);
            }
        }, myJBCefBrowser.getCefBrowser());

        myJSQuerySendMessage = JBCefJSQuery.create(myJBCefBrowser);

        myJSQuerySendMessage.addHandler((message) -> {
            LOG.info(message);
            try {
                this.postMessage(new JSONObject(message));
            } catch (Exception err) {
                LOG.error(err);
            }
            return null;
        });

        browser = myJBCefBrowser.getComponent();

        // Add look and feel listener
        messageBusConnection.subscribe(LafManagerListener.TOPIC, source -> setWebStyle());

        // Add document change listener
        com.intellij.openapi.editor.Document document = FileDocumentManager.getInstance().getDocument(file);
        if (document != null) {
            document.addDocumentListener(new DocumentListener() {
                @Override
                public void documentChanged(final DocumentEvent e) {

                    try {
                        if (browser != null) {
                            InitMessage send = new InitMessage();
                            send.type = "PercyEditorFileChanged";
                            send.fileContent = e.getDocument().getText();
                            sendToJS(send);
                        }
                    } catch (JsonProcessingException err) {
                        LOG.error(err);
                    }
                }
            }, this);
        }
    }

    /**
     * Set web style.
     */
    private void setWebStyle() {
        String url = UIUtil.isUnderDarcula() ? HttpServer.getStaticUrl("darcula.css")
            : HttpServer.getStaticUrl("default.css");
        LOG.info(url);
        myJBCefBrowser.getCefBrowser().executeJavaScript(
            "window.injectCss('" + url + "');",
            myJBCefBrowser.getCefBrowser().getURL(), 0);
    }

    /**
     * Send message to javascript.
     *
     * @param toSend The message to send
     * @throws JsonProcessingException if JSON error occurs
     */
    private void sendToJS(Object toSend) throws JsonProcessingException {
        String toSendStr = mapper.writeValueAsString(toSend);
        LOG.info(toSendStr);

        myJBCefBrowser.getCefBrowser().executeJavaScript(
            "window.sendMessage(JSON.stringify(" + toSendStr + "));",
            myJBCefBrowser.getCefBrowser().getURL(),
            0
        );
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
     * Post message.
     *
     * @param message The post message received from javascript.
     * @throws IOException if any I/O error occurs
     */
    @SuppressWarnings("unchecked")
    public void postMessage(@Nullable JSONObject message) throws IOException {
        String type = message.getString("type");
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
            String fileContent = message.getString("fileContent");
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
            modified = message.getBoolean("dirty");
            LOG.info("modified: " + modified);
        }
    }

    /**
     * Get editor component.
     *
     * @return editor component
     */
    @Override
    public JComponent getComponent() {
        return this.browser;
    }

    /**
     * Get editor component to focus.
     *
     * @return editor component to focus
     */
    @Override
    public JComponent getPreferredFocusedComponent() {
        return this.browser;
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
     * Dispose this editor.
     */
    @Override
    public void dispose() {
        myJBCefBrowser.getJBCefClient().removeLoadHandler(myCefLoadHandler, myJBCefBrowser.getCefBrowser());
        Disposer.dispose(myJSQuerySendMessage);
        messageBusConnection.dispose();
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
