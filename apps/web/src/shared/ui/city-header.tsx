import { useClerk } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { isClerkPublishableConfigured } from "@/shared/auth/clerk";
import { Avatar } from "@/shared/ui/avatar";

export interface CityViewer {
  id: string;
  imageUrl: string | null;
  isAdmin: boolean;
  name: string;
}

export interface CityHeaderProps {
  cityName: string;
  citySlug: string;
  countryName: string;
  merchEnabled: boolean;
  viewer: CityViewer | null;
}

export function CityHeader({
  cityName,
  citySlug,
  countryName,
  merchEnabled,
  viewer,
}: CityHeaderProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const city = { citySlug };
  const clerkReady = isClerkPublishableConfigured();

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((open) => !open);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <header className="city-header">
      <div className="city-header-inner">
        <Link className="city-brand" params={city} to="/$citySlug">
          <span aria-hidden="true" className="city-mark">
            C
          </span>
          <span className="city-brand-text">
            <strong>{cityName}</strong>
            <span className="muted">Claude Code Meetups {countryName}</span>
          </span>
        </Link>

        <nav className="city-nav-desktop">
          <Link
            activeOptions={{ exact: true }}
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug"
          >
            Home
          </Link>
          <Link
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug/events"
          >
            Events
          </Link>
          <Link
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug/resources"
          >
            Resources
          </Link>
          <Link
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug/speak"
          >
            Speak
          </Link>
          <Link
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug/membership"
          >
            Membership
          </Link>
          {merchEnabled ? (
            <Link
              activeProps={{ className: "city-nav-link city-nav-link-active" }}
              className="city-nav-link"
              params={city}
              to="/$citySlug/merch"
            >
              Merch
            </Link>
          ) : null}
          <Link
            activeProps={{ className: "city-nav-link city-nav-link-active" }}
            className="city-nav-link"
            params={city}
            to="/$citySlug/community"
          >
            Community
          </Link>
          {viewer?.isAdmin ? (
            <Link
              activeProps={{ className: "city-nav-link city-nav-link-active" }}
              className="city-nav-link"
              params={city}
              to="/$citySlug/admin"
            >
              Admin
            </Link>
          ) : null}
          {viewer ? (
            <div className="city-session">
              <Link params={city} to="/$citySlug/community/profile">
                <Avatar
                  className="size-9 rounded-full"
                  fallbackClassName="bg-accent text-white text-sm font-semibold"
                  name={viewer.name}
                  src={viewer.imageUrl}
                />
              </Link>
              {clerkReady ? <ClerkSignOut citySlug={citySlug} /> : null}
            </div>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Community Login
            </Link>
          )}
        </nav>

        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="city-menu-btn"
          onClick={handleToggleMenu}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen ? (
        <nav className="city-nav-mobile">
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug">
            Home
          </Link>
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug/events">
            Events
          </Link>
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug/resources">
            Resources
          </Link>
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug/speak">
            Speak
          </Link>
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug/membership">
            Membership
          </Link>
          {merchEnabled ? (
            <Link onClick={handleCloseMenu} params={city} to="/$citySlug/merch">
              Merch
            </Link>
          ) : null}
          <Link onClick={handleCloseMenu} params={city} to="/$citySlug/community">
            Community
          </Link>
          {viewer?.isAdmin ? (
            <Link onClick={handleCloseMenu} params={city} to="/$citySlug/admin">
              Admin
            </Link>
          ) : null}
          {viewer && clerkReady ? (
            <ClerkSignOut citySlug={citySlug} />
          ) : (
            <Link className="btn btn-primary" onClick={handleCloseMenu} to="/login">
              Community Login
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}

function ClerkSignOut({ citySlug }: { citySlug: string }): ReactElement {
  const { signOut } = useClerk();
  const handleSignOut = useCallback(() => {
    signOut({ redirectUrl: `/${citySlug}` }).catch(() => undefined);
  }, [citySlug, signOut]);
  return (
    <button className="btn btn-primary" onClick={handleSignOut} type="button">
      Sign out
    </button>
  );
}
