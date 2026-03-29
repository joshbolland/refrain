import SwiftUI
import UIKit

struct LyricEditorView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.keyboardObserver) private var keyboardObserver

    let file: LyricFile

    @State private var viewModel: EditorViewModel
    @State private var showRhymeSuggestions = true
    @State private var collectionSheetItem: LibraryItem?
    @State private var shareSheetURL: URL?
    @State private var shareErrorMessage: String?
    @State private var previousTabBarHidden = false
    @FocusState private var isTitleFocused: Bool

    init(file: LyricFile) {
        self.file = file
        self._viewModel = State(initialValue: EditorViewModel(file: file))
    }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                editorHeader(topInset: geometry.safeAreaInsets.top)

                LyricTextEditor(
                    text: $viewModel.body,
                    sectionTypes: viewModel.sectionTypes,
                    parsedLines: viewModel.parsedLines,
                    currentWord: viewModel.currentWord,
                    showsRhymeSuggestions: showRhymeSuggestions && keyboardObserver.isVisible,
                    onSectionBadgeTap: { lineIndex in
                        viewModel.openPickerForEditing(at: lineIndex)
                    },
                    onCursorChange: { lineIndex, word in
                        viewModel.updateCursorPosition(lineIndex: lineIndex, word: word)
                    },
                    pickerLineIndex: viewModel.pickerLineIndex,
                    pickerMode: viewModel.pickerMode,
                    onPickerSelect: { type in
                        if let lineIndex = viewModel.pickerLineIndex {
                            viewModel.setSectionType(at: lineIndex, to: type)
                        }
                        viewModel.dismissPicker()
                    },
                    onPickerDismiss: {
                        viewModel.dismissPicker(suppressAutoOpen: true)
                    }
                )
                .padding(.horizontal, 24)
                .padding(.top, 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Theme.paper)
            .ignoresSafeArea(edges: .top)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $collectionSheetItem) { item in
            CollectionsSheet(item: item)
        }
        .sheet(isPresented: shareSheetIsPresented, onDismiss: {
            shareSheetURL = nil
        }) {
            if let shareSheetURL {
                ActivityViewController(activityItems: [shareSheetURL])
            }
        }
        .alert("Unable to Share", isPresented: shareErrorIsPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(shareErrorMessage ?? "Please try again.")
        }
        .task {
            viewModel.appState = appState
            await viewModel.startAutoSave()
        }
        .onAppear {
            previousTabBarHidden = appState.isTabBarHidden
            appState.isTabBarHidden = true

            // Auto-focus title for new files
            if viewModel.isNewFile {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isTitleFocused = true
                }
            }
        }
        .onDisappear {
            appState.isTabBarHidden = previousTabBarHidden
        }
    }

    private func editorHeader(topInset: CGFloat) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    dismiss()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .semibold))

                        Text("BACK")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(2)
                    }
                    .foregroundStyle(Theme.accentPressed)
                    .padding(.vertical, 6)
                }
                .buttonStyle(PressableScaleStyle())

                Spacer()

                rhymeToggle

                Menu {
                    Button {
                        collectionSheetItem = .lyric(file)
                    } label: {
                        Label("Add to Collection", systemImage: "folder.badge.plus")
                    }

                    Button {
                        shareCurrentLyric()
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }

                    Divider()

                    Button(role: .destructive) {
                        Task {
                            await appState.deleteLyricFile(file)
                            dismiss()
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.muted.opacity(0.7))
                        .padding(6)
                }
                .buttonStyle(PressableScaleStyle())
            }
            .padding(.top, topInset + 6)
            .padding(.horizontal, 20)
            .padding(.bottom, 10)

            headerRule

            TextField("Title", text: $viewModel.title)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .textFieldStyle(.plain)
                .focused($isTitleFocused)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)

            headerRule
        }
        .background(Theme.paper)
    }

    private var headerRule: some View {
        Rectangle()
            .fill(Theme.accent.opacity(0.6))
            .frame(height: 1)
            .padding(.horizontal, 24)
    }

    private var rhymeToggle: some View {
        Button {
            showRhymeSuggestions.toggle()
        } label: {
            Text("RHYMES")
                .font(.system(size: 11, weight: .semibold))
                .tracking(2)
                .foregroundStyle(showRhymeSuggestions ? Theme.accentPressed : Theme.muted.opacity(0.75))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(showRhymeSuggestions ? Theme.accentSoft : Theme.paper)
                .overlay(
                    Capsule()
                        .stroke(
                            showRhymeSuggestions ? Theme.accent.opacity(0.5) : Theme.divider,
                            lineWidth: 1
                        )
                )
                .clipShape(Capsule())
        }
        .buttonStyle(PressableScaleStyle())
    }

    private var shareErrorIsPresented: Binding<Bool> {
        Binding(
            get: { shareErrorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    shareErrorMessage = nil
                }
            }
        )
    }

    private var shareSheetIsPresented: Binding<Bool> {
        Binding(
            get: { shareSheetURL != nil },
            set: { isPresented in
                if !isPresented {
                    shareSheetURL = nil
                }
            }
        )
    }

    private func shareCurrentLyric() {
        let exportedText = exportedLyricText()

        do {
            shareSheetURL = try writeExportFile(contents: exportedText)
        } catch {
            shareErrorMessage = error.localizedDescription
        }
    }

    private func exportedLyricText() -> String {
        let trimmedTitle = viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = trimmedTitle.isEmpty ? "Untitled" : trimmedTitle
        let trimmedBody = viewModel.body.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedBody.isEmpty else {
            return title
        }

        return "\(title)\n\n\(trimmedBody)"
    }

    private func writeExportFile(contents: String) throws -> URL {
        let directory = FileManager.default.temporaryDirectory
        let filename = sanitizedFilename(from: viewModel.title)
        let url = directory.appendingPathComponent(filename).appendingPathExtension("txt")

        try contents.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    private func sanitizedFilename(from title: String) -> String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackTitle = trimmed.isEmpty ? "Untitled" : trimmed
        let invalidCharacters = CharacterSet(charactersIn: "/\\?%*|\"<>:")
        let cleanedScalars = fallbackTitle.unicodeScalars.map { scalar in
            invalidCharacters.contains(scalar) ? "-" : Character(scalar)
        }
        let cleaned = String(cleanedScalars).trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Untitled" : cleaned
    }
}

private struct ActivityViewController: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    NavigationStack {
        LyricEditorView(file: LyricFile(
            title: "Test Song",
            body: "First verse line\nSecond line here\n\nChorus begins\nAnother chorus line"
        ))
    }
    .environment(AppState.preview())
    .environment(\.isPreview, true)
}
