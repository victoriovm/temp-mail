import { EmailClient } from "@/components/EmailClient";
import { ThemeProvider } from "@/components/ThemeProvider";

const Index = () => {
  return (
    <ThemeProvider defaultTheme="system">
      <EmailClient />
    </ThemeProvider>
  );
};

export default Index;
