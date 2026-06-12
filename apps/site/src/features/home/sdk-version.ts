import sdkPackage from "../../../../../packages/sdk/package.json" with {
  type: "json",
};

/** Published @web-ai-sdk/all version; used as the displayed suite version. */
export const SDK_VERSION = sdkPackage.version;
