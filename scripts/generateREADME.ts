import * as fs from "fs";
import * as path from "path";
import loadSnippets from "../src/snippets";
import { CompiledSnippet } from "../src/snip";

const table: Array<string> = [];
const markdown: Array<string> = [];
const commands: Array<Record<string, any>> = [];

const root = path.resolve(__dirname, "..");

const headingUrl = (heading: string): string =>
  "#" +
  heading
    .replace(/&[^;]+;/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^-a-z0-9]/gi, "")
    .trim()
    .toLowerCase();

(async () => {
  await loadSnippets().then(async (e) => {
    for (const snippet of Object.values(e)) {
      const { prefix } = snippet;

      commands.push({
        command: `extension.${prefix}`,
        title:
          "Insert " +
          snippet.description.replace(/^\s*React Native Paper\s*/i, "") +
          " Component",
        category: "React Native Paper Snippets",
      });

      const description = snippet.description.replace(
        /^\s*React Native Paper\s*/i,
        ""
      );
      const heading = `\`${prefix}\``;
      table.push(`- [${heading}](${headingUrl(heading)})`);
      markdown.push(`### ${heading}`);
      markdown.push(`##### ${description} Component`);
      if (typeof snippet.body === "function") {
        const { parameters } = snippet.body as CompiledSnippet;
        if (parameters.has("formControlMode")) {
          markdown.push(`#### Controlled`);
          markdown.push(
            "```\n" +
              snippet
                .body({
                  language: "typescriptreact",
                  formControlMode: "controlled",
                })
                .replace(/^\n|\n$/gm, "") +
              "\n```"
          );
          markdown.push(`#### Uncontrolled`);
          markdown.push(
            "```\n" +
              snippet
                .body({
                  language: "typescriptreact",
                  formControlMode: "uncontrolled",
                })
                .replace(/^\n|\n$/gm, "") +
              "\n```"
          );
        } else {
          markdown.push(
            "```\n" +
              snippet
                .body({
                  language: "typescriptreact",
                  formControlMode: "controlled",
                })
                .replace(/^\n|\n$/gm, "") +
              "\n```"
          );
        }
      } else {
        markdown.push(
          "```\n" + snippet.body.replace(/^\n|\n$/gm, "") + "\n```"
        );
      }
    }

    const packageJsonPath = path.join(root, "package.json");
    const packageJson = require("./../package.json");

    packageJson.contributes.commands = commands;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    const readmePath = path.join(root, "README.md");

    const oldReadme = fs.readFileSync(readmePath, "utf8");
    const startComment = /<!--\s*snippets\s*-->/.exec(oldReadme);
    const endComment = /<!--\s*snippetsend\s*-->/.exec(oldReadme);
    if (startComment && endComment && endComment.index > startComment.index) {
      const newReadme = `${oldReadme.substring(
        0,
        startComment.index + startComment[0].length
      )}
${table.join("\n")}
${markdown.join("\n\n")}
${oldReadme.substring(endComment.index)}`;

      if (newReadme !== oldReadme) {
        fs.writeFileSync(readmePath, newReadme, "utf8");
      }
    }
  });
})();
