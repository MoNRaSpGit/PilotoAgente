import { LoginPanel } from './login/components/LoginPanel';
import { useLoginPageController } from './login/useLoginPageController';

function LoginPage() {
  const {
    form,
    loading,
    panelUnlocked,
    handleChange,
    handleSubmit,
    handleQuickLogin,
    handleLogoTap,
    handleCloseApp
  } = useLoginPageController();

  return (
    <section className="page-section login-secret-page">
      <LoginPanel
        form={form}
        loading={loading}
        panelUnlocked={panelUnlocked}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        handleQuickLogin={handleQuickLogin}
        handleLogoTap={handleLogoTap}
        handleCloseApp={handleCloseApp}
      />
    </section>
  );
}

export default LoginPage;
