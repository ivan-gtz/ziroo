
import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const BrandingManager: React.FC = () => {
    const { systemSettings, branchSettings } = useAppContext();

    useEffect(() => {
        // 1. Update Title
        const newTitle = systemSettings.appTitle || 'Ziroo chef';
        if (document.title !== newTitle) {
            document.title = newTitle;
        }

        // 2. Update Favicon & Shortcut Icons
        const faviconUrl = systemSettings.faviconUrl || systemSettings.pwaIconUrl;
        if (faviconUrl) {
            // Update all icons: favicon, shortcut icon, apple-touch-icon
            const selectors = ["link[rel~='icon']", "link[rel~='shortcut']", "link[rel='apple-touch-icon']"];
            selectors.forEach(selector => {
                let link: HTMLLinkElement | null = document.querySelector(selector);
                if (!link) {
                    link = document.createElement('link');
                    if (selector.includes('apple')) link.rel = 'apple-touch-icon';
                    else if (selector.includes('shortcut')) link.rel = 'shortcut icon';
                    else link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = faviconUrl;
            });
        }

        // 3. Dynamic PWA Manifest
        const appName = systemSettings.appTitle || "Ziroo chef";
        const finalName = appName.toLowerCase().includes('chef') ? appName : `${appName} chef`;
        const iconUrl = systemSettings.pwaIconUrl || "/logo-green.png";

        const manifest = {
            name: finalName,
            short_name: finalName,
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#06c167",
            icons: [
                {
                    src: iconUrl,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: iconUrl,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any"
                },
                {
                    src: iconUrl,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "maskable"
                },
                {
                    src: iconUrl,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "maskable"
                }
            ]
        };

        const stringManifest = JSON.stringify(manifest);
        const blob = new Blob([stringManifest], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            manifestLink.setAttribute('rel', 'manifest');
            document.head.appendChild(manifestLink);
        }
        manifestLink.setAttribute('href', manifestURL);

        return () => {
            URL.revokeObjectURL(manifestURL);
        };
    }, [systemSettings.appTitle, systemSettings.faviconUrl, systemSettings.pwaIconUrl, systemSettings.shareImage, branchSettings?.shareImage, branchSettings?.restaurantName]);

    useEffect(() => {
        // 4. Update Meta Tags (Social Sharing Previews)
        const faviconUrl = systemSettings.faviconUrl || systemSettings.pwaIconUrl;
        const shareImage = branchSettings?.shareImage || systemSettings.shareImage || faviconUrl || (window.location.origin + "/logo-green.png");

        const shareTitle = branchSettings?.restaurantName || systemSettings.appTitle || "Ziroo chef";
        const shareDesc = branchSettings?.address || "Ziroo chef - Software para Restaurantes y Reparto";

        const metaTags = [
            { property: 'og:title', content: shareTitle },
            { property: 'og:description', content: shareDesc },
            { property: 'og:image', content: shareImage },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: window.location.href.split('#')[0] },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: shareTitle },
            { name: 'twitter:description', content: shareDesc },
            { name: 'twitter:image', content: shareImage }
        ];

        metaTags.forEach(tag => {
            const attr = tag.property ? `property="${tag.property}"` : `name="${tag.name}"`;
            let element = document.head.querySelector(`meta[${attr}]`);
            if (!element) {
                element = document.createElement('meta');
                if (tag.property) element.setAttribute('property', tag.property);
                if (tag.name) element.setAttribute('name', tag.name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', tag.content);
        });

        // 5. Update Global Icons
        const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
        if (appleIcon) appleIcon.setAttribute('href', shareImage);

    }, [systemSettings, branchSettings]);

    return null;
};

export default BrandingManager;
