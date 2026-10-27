import { applianceVite } from "@wired-square/appliance-ui/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(applianceVite({ plugins: [solid()] }));
