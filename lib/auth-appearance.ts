/**
 * Clerk styling shared by the sign-in and sign-up windows. Plain CSS objects
 * (not class names) so they beat Clerk's own card, shadow and footer styles.
 */
const INK = "#111111";
const MUTED = "#626262";
const LINE = "#E3E3E3";

export const authAppearance = {
  variables: {
    colorPrimary: INK,
    colorText: "#1A1A1A",
    colorTextSecondary: MUTED,
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#1A1A1A",
    colorDanger: "#B42318",
    borderRadius: "12px",
    fontFamily: "var(--font-poppins), Poppins, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "0", background: "transparent", borderRadius: 0, overflow: "visible" },
    card: { boxShadow: "none", border: "0", background: "transparent", padding: "0 2px", gap: "20px", width: "100%", overflow: "visible" },

    headerTitle: {
      fontFamily: "var(--font-cormorant), Georgia, serif",
      fontWeight: 500,
      fontSize: "38px",
      lineHeight: 1.05,
      color: "#111",
    },
    headerSubtitle: { fontSize: "13px", color: MUTED, lineHeight: 1.5 },

    socialButtonsBlockButton: {
      height: "52px !important",
      borderRadius: "999px",
      border: `1px solid ${LINE}`,
      borderWidth: "1px !important",
      boxShadow: "none !important",
      background: "#fff",
      "&:hover": { background: "#F7F7F7" },
    },
    socialButtonsBlockButtonText: { fontSize: "15px", fontWeight: 500, color: "#111" },
    dividerLine: { background: LINE },
    dividerText: { color: "#8A8A8A", fontSize: "12px" },

    formFieldLabel: { fontSize: "12px", fontWeight: 500, color: MUTED },
    formFieldInput: {
      height: "54px !important",
      minHeight: "54px !important",
      borderRadius: "12px",
      border: `1px solid ${LINE}`,
      borderWidth: "1px !important",
      boxShadow: "none !important",
      fontSize: "15px",
      "&:focus": { borderColor: INK, boxShadow: "0 0 0 3px rgba(17,17,17,0.12)" },
    },
    formFieldAction: { color: INK, fontSize: "13px", textDecoration: "underline", textUnderlineOffset: "3px" },
    formFieldInputShowPasswordButton: { color: MUTED },
    otpCodeFieldInput: { height: "50px", borderRadius: "10px", border: `1px solid ${LINE}`, borderWidth: "1px !important", boxShadow: "none" },
    formResendCodeLink: { color: INK, textDecoration: "underline", textUnderlineOffset: "3px" },
    identityPreviewEditButton: { color: INK },
    backLink: { color: INK },

    formButtonPrimary: {
      height: "54px !important",
      borderRadius: "999px",
      background: `${INK} !important`,
      backgroundImage: "none !important",
      boxShadow: "none !important",
      "&::after": { display: "none !important", backgroundImage: "none !important" },
      "&:hover::after": { display: "none !important" },
      fontSize: "15px",
      fontWeight: 500,
      textTransform: "none",
      "&:hover": { background: "#2a2a2a !important" },
      "&:focus-visible": { boxShadow: "0 0 0 3px rgba(17,17,17,0.25)" },
    },

    alert: { borderRadius: "10px" },

    footer: { background: "transparent", boxShadow: "none", border: 0, margin: 0 },
    footerAction: { background: "transparent", padding: "4px 0" },
    footerActionText: { color: MUTED, fontSize: "13px" },
    footerActionLink: { color: INK, fontSize: "13px", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" },
  },
} as const;
