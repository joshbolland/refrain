import SwiftUI
import UniformTypeIdentifiers

struct LinkItemSheet: View {
    private enum LinkMode: String, CaseIterable, Identifiable {
        case existing
        case importFile
        case createNew

        var id: String { rawValue }
    }

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let sourceItem: LibraryItem

    @State private var mode: LinkMode = .existing
    @State private var isImporting = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var createdLyric: LyricFile?
    @State private var showRecording = false

    private var targetLabel: String {
        sourceItem.isRecording ? "lyric" : "recording"
    }

    private var targetTitle: String {
        sourceItem.isRecording ? "Link Lyric" : "Link Recording"
    }

    private var existingCandidates: [LibraryItem] {
        appState.linkCandidates(for: sourceItem)
    }

    private var linkedItems: [LibraryItem] {
        appState.linkedItems(for: sourceItem)
    }

    private var importerTypes: [UTType] {
        sourceItem.isRecording ? [.plainText, .text] : [.audio]
    }

    private var errorIsPresented: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    errorMessage = nil
                }
            }
        )
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                sourceSummary

                Picker("Link source", selection: $mode) {
                    Label("Existing", systemImage: "list.bullet").tag(LinkMode.existing)
                    Label("Import", systemImage: "square.and.arrow.down").tag(LinkMode.importFile)
                    Label("New", systemImage: "plus").tag(LinkMode.createNew)
                }
                .pickerStyle(.segmented)

                content

                Spacer(minLength: 0)
            }
            .padding(20)
            .background(Theme.canvas.ignoresSafeArea())
            .navigationTitle(targetTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }
            }
            .sheet(isPresented: $showRecording) {
                RecordingView { recording in
                    Task {
                        await link(target: .recording(recording), dismissWhenDone: true)
                    }
                }
            }
            .sheet(item: $createdLyric) { file in
                NavigationStack {
                    LyricEditorView(file: file)
                }
            }
            .fileImporter(
                isPresented: $isImporting,
                allowedContentTypes: importerTypes,
                allowsMultipleSelection: false,
                onCompletion: handleImport
            )
            .alert("Unable to Link", isPresented: errorIsPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "Please try again.")
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .existing:
            existingPicker
        case .importFile:
            importPanel
        case .createNew:
            createPanel
        }
    }

    private var sourceSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: sourceItem.isLyric ? "music.note" : "waveform")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.accentPressed)
                    .frame(width: 42, height: 42)
                    .background(Theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(sourceItem.title.isEmpty ? "Untitled" : sourceItem.title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)

                    Text("Choose a \(targetLabel) to keep with this \(sourceItem.isLyric ? "lyric" : "recording").")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if !linkedItems.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Already linked")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1)
                        .foregroundStyle(Theme.headerSubtitle)

                    VStack(spacing: 8) {
                        ForEach(linkedItems, id: \.id) { item in
                            linkedItemSummary(item)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var existingPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                title: "Existing \(sourceItem.isRecording ? "Lyrics" : "Recordings")",
                subtitle: existingCandidates.isEmpty
                    ? "There are no unlinked \(sourceItem.isRecording ? "lyrics" : "recordings") yet."
                    : "Select an item from your library."
            )

            if existingCandidates.isEmpty {
                emptyPanel(systemImage: "tray", title: "Nothing to link yet")
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(existingCandidates, id: \.id) { item in
                            Button {
                                Task {
                                    await link(target: item, dismissWhenDone: true)
                                }
                            } label: {
                                linkCandidateRow(item)
                            }
                            .buttonStyle(PressableScaleStyle())
                            .disabled(isSaving)
                        }
                    }
                }
            }
        }
    }

    private var importPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(
                title: "Import \(sourceItem.isRecording ? "Lyrics" : "Recording")",
                subtitle: sourceItem.isRecording
                    ? "Import a plain text lyric file and link it to this recording."
                    : "Import an audio file and link it to this lyric."
            )

            Button {
                isImporting = true
            } label: {
                Label("Choose File", systemImage: "folder")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(isSaving)
        }
        .padding(16)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var createPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(
                title: "Create New \(sourceItem.isRecording ? "Lyric" : "Recording")",
                subtitle: sourceItem.isRecording
                    ? "Create a blank lyric and link it immediately."
                    : "Record a new take and link it after saving."
            )

            Button {
                if sourceItem.isRecording {
                    Task { await createAndLinkLyric() }
                } else {
                    showRecording = true
                }
            } label: {
                Label(sourceItem.isRecording ? "Create Lyric" : "Record Audio", systemImage: sourceItem.isRecording ? "square.and.pencil" : "mic")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(isSaving)
        }
        .padding(16)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private func linkedItemSummary(_ item: LibraryItem) -> some View {
        HStack(spacing: 10) {
            Image(systemName: item.isLyric ? "music.note" : "waveform")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
                .frame(width: 26, height: 26)
                .background(Theme.accentSoft)
                .clipShape(Circle())

            Text(item.title.isEmpty ? "Untitled" : item.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)

            Spacer()
        }
    }

    private func linkCandidateRow(_ item: LibraryItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: item.isLyric ? "music.note" : "waveform")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
                .frame(width: 36, height: 36)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title.isEmpty ? "Untitled" : item.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)

                Text(detailLabel(for: item))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted.opacity(0.82))
                    .lineLimit(1)
            }

            Spacer()

            Image(systemName: "link.badge.plus")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }

    private func sectionHeader(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func emptyPanel(systemImage: String, title: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)

            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private func detailLabel(for item: LibraryItem) -> String {
        switch item {
        case .lyric(let file):
            let trimmedBody = file.body.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmedBody.isEmpty ? "Lyric draft" : trimmedBody
        case .recording(let recording):
            return "\(recording.formattedDuration) recording"
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            Task {
                await importAndLink(url: url)
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }

    private func importAndLink(url: URL) async {
        isSaving = true
        defer { isSaving = false }

        do {
            let target: LibraryItem
            if sourceItem.isRecording {
                target = .lyric(try await appState.importLyricFile(from: url))
            } else {
                target = .recording(try await appState.importRecordingFile(from: url))
            }

            await link(target: target, dismissWhenDone: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func createAndLinkLyric() async {
        guard case .recording(let recording) = sourceItem else { return }
        isSaving = true
        defer { isSaving = false }

        let title = recording.title.isEmpty ? "Untitled Lyrics" : "\(recording.title) Lyrics"
        guard let file = await appState.createLyricFile(title: title) else {
            errorMessage = "The lyric could not be created."
            return
        }

        if await appState.linkRecording(recording, to: file) == nil {
            errorMessage = "The lyric was created, but the link could not be saved."
            return
        }

        createdLyric = file
    }

    private func link(target: LibraryItem, dismissWhenDone: Bool) async {
        isSaving = true
        defer { isSaving = false }

        guard await appState.link(sourceItem, to: target) != nil else {
            errorMessage = "The link could not be saved."
            return
        }

        if dismissWhenDone {
            dismiss()
        }
    }
}

#Preview("Link Recording to Lyric") {
    LinkItemSheet(sourceItem: .recording(AppState.previewRecording()))
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Link Lyric to Recording") {
    LinkItemSheet(sourceItem: .lyric(AppState.previewLyric()))
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
