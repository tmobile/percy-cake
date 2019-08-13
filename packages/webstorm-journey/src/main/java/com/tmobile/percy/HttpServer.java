/*
 * Copyright (C) 2019 TopCoder Inc., All Rights Reserved.
 */
package com.tmobile.percy;

import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

import org.jetbrains.ide.BuiltInServerManager;
import org.jetbrains.ide.HttpRequestHandler;
import org.jetbrains.io.FileResponses;
import org.jetbrains.io.Responses;

import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.util.io.FileUtilRt;
import com.intellij.util.Url;
import com.intellij.util.Urls;

import io.netty.buffer.Unpooled;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpRequest;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.QueryStringDecoder;

/**
 * The http server.
 *
 * @author TCSCODER
 * @version 1.0
 */
public class HttpServer extends HttpRequestHandler {

    /**
     * The logger.
     */
    private static final Logger LOG = Logger.getInstance(HttpServer.class);

    /**
     * The prefix.
     */
    private static final String PREFIX = "/percy/";

    /**
     * Get url to path.
     *
     * @param path The url path
     * @return url to path
     */
    public static String getStaticUrl(String path) {
        Url url = Urls.parseEncoded("http://localhost:" + BuiltInServerManager.getInstance().getPort() + PREFIX + path);
        return BuiltInServerManager.getInstance().addAuthToken(Objects.requireNonNull(url)).toExternalForm();
    }

    /**
     * Check whether request is supported.
     *
     * @param request The Http request
     * @return true if request is supported; false otherwise
     */
    @Override
    public boolean isSupported(FullHttpRequest request) {
        LOG.info("isSupported: " + request.uri());

        return super.isSupported(request) && request.uri().startsWith(PREFIX);
    }

    /**
     * Process Http request.
     *
     * @param urlDecoder Url decoder
     * @param request    Http request
     * @param context    Context
     * @return true always
     */
    @Override
    public boolean process(QueryStringDecoder urlDecoder, FullHttpRequest request, ChannelHandlerContext context) {
        String path = urlDecoder.path();
        LOG.info(path);

        if (!path.startsWith(PREFIX)) {
            throw new IllegalStateException("prefix should be " + PREFIX);
        }

        String payLoad;
        if (path.equalsIgnoreCase(PREFIX)) {
            payLoad = "index.html";
        } else {
            payLoad = path.substring(PREFIX.length());
        }
        sendResource(request, context.channel(), payLoad);

        return true;
    }

    /**
     * Send resource.
     *
     * @param request      Http request
     * @param channel      Channel
     * @param resourceName Resource name
     */
    private static void sendResource(HttpRequest request, Channel channel, String resourceName) {

        byte[] data;
        try (InputStream inputStream = HttpServer.class.getResourceAsStream("/" + resourceName)) {
            if (inputStream == null) {
                LOG.warn(resourceName + " is not found");
                Responses.send(HttpResponseStatus.NOT_FOUND, channel, request);
                return;
            }

            data = FileUtilRt.loadBytes(inputStream);
        } catch (IOException e) {
            LOG.warn(e);
            Responses.send(HttpResponseStatus.INTERNAL_SERVER_ERROR, channel, request);
            return;
        }

        FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.OK,
                Unpooled.wrappedBuffer(data));
        response.headers().set(HttpHeaderNames.CONTENT_TYPE, FileResponses.INSTANCE.getContentType(resourceName));
        Responses.send(response, channel, request);
    }

}
