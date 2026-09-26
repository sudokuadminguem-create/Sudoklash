// Tailwind for the self-hosted (Docker) build only; the hosting platform sets up CSS itself.
export default {
  plugins: process.env.SUDOKLASH_SELF_HOSTED === "1" ? { "@tailwindcss/postcss": {} } : {},
};
