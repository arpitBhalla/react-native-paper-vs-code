import * as vscode from "vscode";
import loadSnippets, { SnippetOptions } from "./snippets";
import shallowEqual from "shallowequal";
import getExistingImports from "./getExistingImports";
import { getSnippetImports } from "./utils";
class RNPCompletionItem extends vscode.CompletionItem {
  imports: string[] | undefined;
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration("rnp.snippets");
  if (config.get("showNotesOnStartup")) {
    const message =
      "RNP Snippets: automatic imports for snippets have been re-enabled now that the VSCode completions API has been improved.";
    vscode.window.showInformationMessage(message);
    config.update(
      "showNotesOnStartup",
      false,
      vscode.ConfigurationTarget.Global
    );
  }

  const snippets = await loadSnippets();

  function getAdditionalTextEdits({
    imports,
  }: {
    imports: string[] | undefined;
  }): vscode.TextEdit[] {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || !imports) return [];

    let existingImports: Set<string> | null;
    let insertPosition: vscode.Position = new vscode.Position(0, 0);
    let coreInsertPosition: vscode.Position | null = null;
    try {
      ({
        existingImports,
        insertPosition,
        coreInsertPosition,
      } = getExistingImports(document));
    } catch (error) {
      existingImports = null;
    }

    const additionalTextEdits: vscode.TextEdit[] = [];
    const finalExistingImports = existingImports;
    if (finalExistingImports) {
      const coreImports = imports.filter(
        (comp: string) => !finalExistingImports.has(comp)
      );
      if (coreImports.length) {
        if (coreInsertPosition) {
          additionalTextEdits.push(
            vscode.TextEdit.insert(
              coreInsertPosition,
              ", " + coreImports.join(", ")
            )
          );
        } else {
          additionalTextEdits.push(
            vscode.TextEdit.insert(
              insertPosition,
              `import { ${coreImports.join(", ")} } from 'react-native-paper'\n`
            )
          );
        }
      }
    }
    return additionalTextEdits;
  }

  for (const snippet of Object.values(snippets)) {
    const { prefix, description } = snippet;
    context.subscriptions.push(
      vscode.commands.registerCommand(`extension.${prefix}`, async () =>
        vscode.window.withProgress(
          {
            cancellable: true,
            location: vscode.ProgressLocation.Notification,
            title: `Inserting RNP ${description}...`,
          },
          async (
            progress: vscode.Progress<{
              message?: string | undefined;
              increment?: number | undefined;
            }>,
            token: vscode.CancellationToken
          ) => {
            const body = (typeof snippet.body === "function"
              ? snippet.body({
                  language: vscode.window.activeTextEditor?.document
                    .languageId as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                  formControlMode:
                    config.get("formControlMode") || "controlled",
                })
              : snippet.body
            ).replace(/^\n|\n$/gm, "");

            if (token.isCancellationRequested) return;

            const additionalTextEdits = getAdditionalTextEdits({
              imports: getSnippetImports(body),
            });

            if (token.isCancellationRequested) return;

            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            await editor.insertSnippet(
              new vscode.SnippetString(body),
              editor.selection
            );
            editor.edit((edit: vscode.TextEditorEdit) => {
              for (const additionalEdit of additionalTextEdits) {
                edit.insert(additionalEdit.range.start, additionalEdit.newText);
              }
            });
          }
        )
      )
    );
  }

  for (const language of ["javascript", "javascriptreact", "typescriptreact"]) {
    let lastOptions: SnippetOptions | null = null;
    let lastCompletionItems: RNPCompletionItem[];

    const getCompletionItems = (
      options: SnippetOptions
    ): RNPCompletionItem[] => {
      if (shallowEqual(options, lastOptions)) {
        return lastCompletionItems;
      }
      lastOptions = options;
      const result = [];
      for (const snippet of Object.values(snippets)) {
        const { prefix, description, docKey, previewURL } = snippet;

        const body = (typeof snippet.body === "function"
          ? snippet.body(options)
          : snippet.body
        ).replace(/^\n|\n$/gm, "");

        let extendedDoc = description;
        extendedDoc += docKey
          ? `\n\n Documentation: [Click here](https://reactnativeelements.com/docs/${docKey})`
          : "";
        extendedDoc += previewURL
          ? `\n\n Preview : \n\n ![${prefix}](${previewURL}) `
          : "";
        const completion = new RNPCompletionItem(prefix);
        completion.insertText = new vscode.SnippetString(body);
        completion.documentation = new vscode.MarkdownString(extendedDoc);
        completion.imports = getSnippetImports(body);
        result.push(completion);
      }
      return (lastCompletionItems = result);
    };

    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(language, {
        provideCompletionItems(
          /* eslint-disable @typescript-eslint/no-unused-vars */
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
          context: vscode.CompletionContext
          /* eslint-enable @typescript-eslint/no-unused-vars */
        ): vscode.ProviderResult<RNPCompletionItem[]> {
          return getCompletionItems({
            language: language as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            formControlMode: "controlled",
          });
        },
        async resolveCompletionItem(
          item: RNPCompletionItem,
          /* eslint-disable @typescript-eslint/no-unused-vars */
          token: vscode.CancellationToken
          /* eslint-enable @typescript-eslint/no-unused-vars */
        ): Promise<RNPCompletionItem> {
          item.additionalTextEdits = getAdditionalTextEdits(item);
          return item;
        },
      })
    );
  }
}
