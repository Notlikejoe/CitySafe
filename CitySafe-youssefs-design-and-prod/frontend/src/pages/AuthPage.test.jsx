import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AuthPage from "./AuthPage";

const { loginSpy, registerSpy, navigateSpy, toastSuccessSpy } = vi.hoisted(() => ({
  loginSpy: vi.fn(),
  registerSpy: vi.fn(),
  navigateSpy: vi.fn(),
  toastSuccessSpy: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: loginSpy,
    register: registerSpy,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: toastSuccessSpy,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const renderPage = () => render(
  <MemoryRouter>
    <AuthPage />
  </MemoryRouter>,
);

const submitButton = (label) => screen.getAllByRole("button", { name: label }).at(-1);

describe("AuthPage", () => {
  beforeEach(() => {
    loginSpy.mockReset();
    registerSpy.mockReset();
    navigateSpy.mockReset();
    toastSuccessSpy.mockReset();
    loginSpy.mockResolvedValue({});
    registerSpy.mockResolvedValue({});
  });

  test("blocks signup when the user has not agreed to the terms", async () => {
    renderPage();

    fireEvent.click(submitButton(/create account/i));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. john_doe/i), {
      target: { value: "student_user" },
    });
    fireEvent.change(screen.getByPlaceholderText(/min 6 chars, letters \+ numbers/i), {
      target: { value: "Test123" },
    });
    fireEvent.click(submitButton(/create account/i));

    expect(await screen.findByText(/you must agree to the terms of service/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  test("submits trimmed credentials during login and redirects on success", async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. john_doe/i), {
      target: { value: "  demo_user  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: "Test123" },
    });
    fireEvent.click(submitButton(/^sign in$/i));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith("demo_user", "Test123");
      expect(navigateSpy).toHaveBeenCalledWith("/");
    });
  });
});
