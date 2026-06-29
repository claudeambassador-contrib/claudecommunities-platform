"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    ShopifyBuy?: {
      UI?: {
        onReady: (client: unknown) => Promise<{
          createComponent: (type: string, options: unknown) => void;
        }>;
      };
      buildClient: (config: { domain: string; storefrontAccessToken: string }) => unknown;
    };
  }
}

const SCRIPT_URL = "https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js";

export default function ShopifyCollection() {
  const nodeRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    function init() {
      const shopify = window.ShopifyBuy;
      if (!shopify?.UI) return;
      const client = shopify.buildClient({
        domain: "yzcfge-sh.myshopify.com",
        storefrontAccessToken: "f9df6b45471bc5d29b3b5fff469fa33e",
      });
      shopify.UI.onReady(client).then((ui) => {
        ui.createComponent("collection", {
          id: "291240673383",
          node: nodeRef.current,
          moneyFormat: "%24%7B%7Bamount%7D%7D",
          options: {
            product: {
              styles: {
                product: {
                  "@media (min-width: 601px)": {
                    "max-width": "calc(25% - 20px)",
                    "margin-left": "20px",
                    "margin-bottom": "50px",
                    width: "calc(25% - 20px)",
                  },
                  img: {
                    height: "calc(100% - 15px)",
                    position: "absolute",
                    left: "0",
                    right: "0",
                    top: "0",
                  },
                  imgWrapper: {
                    "padding-top": "calc(75% + 15px)",
                    position: "relative",
                    height: "0",
                  },
                },
                title: { color: "#FAF9F6" },
                price: { color: "#A8A29E" },
              },
              text: { button: "Add to cart" },
            },
            productSet: {
              styles: {
                products: {
                  "@media (min-width: 601px)": { "margin-left": "-20px" },
                },
              },
            },
            modalProduct: {
              contents: {
                img: false,
                imgWithCarousel: true,
                button: false,
                buttonWithQuantity: true,
              },
              styles: {
                product: {
                  "@media (min-width: 601px)": {
                    "max-width": "100%",
                    "margin-left": "0px",
                    "margin-bottom": "0px",
                  },
                },
              },
              text: { button: "Add to cart" },
            },
            option: {
              styles: {
                label: { color: "#FAF9F6" },
                select: { color: "#FAF9F6", "background-color": "#292524" },
              },
            },
            cart: { text: { total: "Subtotal", button: "Checkout" } },
            toggle: {},
          },
        });
      });
    }

    if (window.ShopifyBuy?.UI) {
      init();
    } else {
      const script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_URL;
      script.onload = init;
      document.head.appendChild(script);
    }
  }, []);

  return <div ref={nodeRef} />;
}
