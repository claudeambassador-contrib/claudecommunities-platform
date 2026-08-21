import type { ReactElement } from "react";
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
let shopifyStarted = false;

export function ShopifyCollection(): ReactElement {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shopifyStarted) {
      return;
    }
    shopifyStarted = true;

    function init() {
      const shopify = window.ShopifyBuy;
      if (!shopify?.UI) {
        return;
      }
      const client = shopify.buildClient({
        domain: "yzcfge-sh.myshopify.com",
        storefrontAccessToken: "f9df6b45471bc5d29b3b5fff469fa33e",
      });
      shopify.UI.onReady(client).then((ui) => {
        ui.createComponent("collection", {
          id: "291240673383",
          moneyFormat: "%24%7B%7Bamount%7D%7D",
          node: nodeRef.current,
          options: {
            cart: { text: { button: "Checkout", total: "Subtotal" } },
            modalProduct: {
              contents: {
                button: false,
                buttonWithQuantity: true,
                img: false,
                imgWithCarousel: true,
              },
              styles: {
                product: {
                  "@media (min-width: 601px)": {
                    "margin-bottom": "0px",
                    "margin-left": "0px",
                    "max-width": "100%",
                  },
                },
              },
              text: { button: "Add to cart" },
            },
            option: {
              styles: {
                label: { color: "#FAF9F6" },
                select: { "background-color": "#292524", color: "#FAF9F6" },
              },
            },
            product: {
              styles: {
                price: { color: "#A8A29E" },
                product: {
                  "@media (min-width: 601px)": {
                    "margin-bottom": "50px",
                    "margin-left": "20px",
                    "max-width": "calc(25% - 20px)",
                    width: "calc(25% - 20px)",
                  },
                  img: {
                    height: "calc(100% - 15px)",
                    left: "0",
                    position: "absolute",
                    right: "0",
                    top: "0",
                  },
                  imgWrapper: {
                    height: "0",
                    "padding-top": "calc(75% + 15px)",
                    position: "relative",
                  },
                },
                title: { color: "#FAF9F6" },
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
            toggle: {},
          },
        });
      });
    }

    if (window.ShopifyBuy?.UI) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.onload = init;
    script.src = SCRIPT_URL;
    document.head.appendChild(script);
  }, []);

  return <div ref={nodeRef} />;
}
