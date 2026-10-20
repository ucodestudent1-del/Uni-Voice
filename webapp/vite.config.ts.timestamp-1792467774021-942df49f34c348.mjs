// vite.config.ts
import { defineConfig } from "file:///C:/Users/New%20User/Desktop/New%20folder/webapp/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/New%20User/Desktop/New%20folder/webapp/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/New%20User/Desktop/New%20folder/webapp/node_modules/@tailwindcss/vite/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "C:\\Users\\New User\\Desktop\\New folder\\webapp";
var vite_config_default = defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src")
    }
  },
  define: {
    "import.meta.env.VITE_PLAUSIBLE_DOMAIN": JSON.stringify(process.env.PLAUSIBLE_DOMAIN ?? "")
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-")) {
              return "charts";
            }
            if (id.includes("lucide-react")) {
              return "icons";
            }
            if (id.includes("@sentry") || id.includes("rrweb")) {
              return "monitoring";
            }
            if (id.includes("decimal.js")) {
              return "decimal";
            }
            if (id.includes("zod")) {
              return "validation";
            }
            if (id.includes("axios")) {
              return "http";
            }
            return "vendor";
          }
        }
      }
    },
    sourcemap: true,
    assetsInlineLimit: 4096,
    assetsHash: true,
    chunkSizeWarningLimit: 2e3,
    minify: "esbuild",
    cssCodeSplit: true,
    reportCompressedSize: false,
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "axios", "react-router-dom"],
    exclude: ["recharts", "@sentry/react"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxOZXcgVXNlclxcXFxEZXNrdG9wXFxcXE5ldyBmb2xkZXJcXFxcd2ViYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxOZXcgVXNlclxcXFxEZXNrdG9wXFxcXE5ldyBmb2xkZXJcXFxcd2ViYXBwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9OZXclMjBVc2VyL0Rlc2t0b3AvTmV3JTIwZm9sZGVyL3dlYmFwcC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYmFzZTogXCIvXCIsXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgZGVmaW5lOiB7XG4gICAgXCJpbXBvcnQubWV0YS5lbnYuVklURV9QTEFVU0lCTEVfRE9NQUlOXCI6IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52LlBMQVVTSUJMRV9ET01BSU4gPz8gXCJcIiksXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IHRydWUsXG4gICAgcG9ydDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovLzEyNy4wLjAuMTo0MDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzXCIpKSB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWNoYXJ0c1wiKSB8fCBpZC5pbmNsdWRlcyhcImQzLVwiKSkge1xuICAgICAgICAgICAgICByZXR1cm4gXCJjaGFydHNcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImx1Y2lkZS1yZWFjdFwiKSkge1xuICAgICAgICAgICAgICByZXR1cm4gXCJpY29uc1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHNlbnRyeVwiKSB8fCBpZC5pbmNsdWRlcyhcInJyd2ViXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcIm1vbml0b3JpbmdcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImRlY2ltYWwuanNcIikpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFwiZGVjaW1hbFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiem9kXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcInZhbGlkYXRpb25cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImF4aW9zXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcImh0dHBcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvclwiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgYXNzZXRzSW5saW5lTGltaXQ6IDQwOTYsXG4gICAgYXNzZXRzSGFzaDogdHJ1ZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDIwMDAsXG4gICAgbWluaWZ5OiBcImVzYnVpbGRcIixcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLFxuICAgIGNvbW1vbmpzT3B0aW9uczoge1xuICAgICAgaW5jbHVkZTogWy9ub2RlX21vZHVsZXMvXSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcImF4aW9zXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcbiAgICBleGNsdWRlOiBbXCJyZWNoYXJ0c1wiLCBcIkBzZW50cnkvcmVhY3RcIl0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVUsU0FBUyxvQkFBb0I7QUFDaFcsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDakM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTix5Q0FBeUMsS0FBSyxVQUFVLFFBQVEsSUFBSSxvQkFBb0IsRUFBRTtBQUFBLEVBQzVGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFDZixjQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IsZ0JBQUksR0FBRyxTQUFTLFVBQVUsS0FBSyxHQUFHLFNBQVMsS0FBSyxHQUFHO0FBQ2pELHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLFNBQVMsS0FBSyxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ2xELHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxZQUFZLEdBQUc7QUFDN0IscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLEtBQUssR0FBRztBQUN0QixxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLHFCQUFPO0FBQUEsWUFDVDtBQUNBLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsbUJBQW1CO0FBQUEsSUFDbkIsWUFBWTtBQUFBLElBQ1osdUJBQXVCO0FBQUEsSUFDdkIsUUFBUTtBQUFBLElBQ1IsY0FBYztBQUFBLElBQ2Qsc0JBQXNCO0FBQUEsSUFDdEIsaUJBQWlCO0FBQUEsTUFDZixTQUFTLENBQUMsY0FBYztBQUFBLElBQzFCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFNBQVMsYUFBYSxTQUFTLGtCQUFrQjtBQUFBLElBQzNELFNBQVMsQ0FBQyxZQUFZLGVBQWU7QUFBQSxFQUN2QztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
