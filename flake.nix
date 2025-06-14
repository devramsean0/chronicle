{
  description = "Basic flake for Astro.js and Bun.js project";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

    outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            nodejs
            python3
            pkg-config
            sqlite
            # Build tools needed for native modules
            gcc
            gnumake
            yarn
            scc
          ];

          shellHook = ''
            export PYTHON="${pkgs.python3}/bin/python3"
            bun install
          '';
        };
      });
}