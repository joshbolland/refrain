import SwiftUI
import UIKit
import VisionKit

struct LyricScanReviewSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let draft: LyricScanDraft
    let onSave: (LyricFile) -> Void

    @State private var title: String
    @State private var bodyText: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(draft: LyricScanDraft, onSave: @escaping (LyricFile) -> Void) {
        self.draft = draft
        self.onSave = onSave
        _title = State(initialValue: draft.title)
        _bodyText = State(initialValue: draft.body)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                scanSummary

                VStack(alignment: .leading, spacing: 10) {
                    Text("Title")
                        .font(.system(size: 12, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Theme.headerSubtitle)

                    TextField("Scanned Lyrics", text: $title)
                        .textFieldStyle(.plain)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .cardStyle()
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Lyrics")
                        .font(.system(size: 12, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Theme.headerSubtitle)

                    TextEditor(text: $bodyText)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.ink)
                        .scrollContentBackground(.hidden)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(minHeight: 280)
                        .background(Theme.paper)
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                .stroke(Theme.divider, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                }

                Button {
                    saveLyric()
                } label: {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Save as Lyric")
                            .frame(maxWidth: .infinity)
                    }
                }
                .primaryButtonStyle()
                .disabled(isSaving || trimmedBody.isEmpty)
                .opacity(isSaving || trimmedBody.isEmpty ? 0.7 : 1)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
            .background(Theme.canvas.ignoresSafeArea())
            .navigationTitle("Review Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }
            }
            .alert("Unable to Save", isPresented: errorIsPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "Please try again.")
            }
        }
    }

    private var trimmedTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Scanned Lyrics" : trimmed
    }

    private var trimmedBody: String {
        bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
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

    private var scanSummary: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "doc.text.viewfinder")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
                .frame(width: 40, height: 40)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(draft.pageCount == 1 ? "1 page scanned" : "\(draft.pageCount) pages scanned")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text("Review the OCR output before adding it to your library.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted.opacity(0.85))
            }

            Spacer()
        }
        .padding(16)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private func saveLyric() {
        guard !trimmedBody.isEmpty else {
            return
        }

        isSaving = true

        Task {
            let createdFile = await appState.createLyricFile(
                title: trimmedTitle,
                body: trimmedBody
            )

            await MainActor.run {
                isSaving = false

                guard let createdFile else {
                    errorMessage = "The scanned lyric could not be saved."
                    return
                }

                onSave(createdFile)
                dismiss()
            }
        }
    }
}

struct LyricDocumentCameraSheet: UIViewControllerRepresentable {
    @Binding var isPresented: Bool

    let onScan: (VNDocumentCameraScan) -> Void
    let onCancel: () -> Void
    let onError: (Error) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let viewController = VNDocumentCameraViewController()
        viewController.delegate = context.coordinator
        return viewController
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let parent: LyricDocumentCameraSheet

        init(parent: LyricDocumentCameraSheet) {
            self.parent = parent
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            controller.dismiss(animated: true)
            parent.isPresented = false
            parent.onScan(scan)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            controller.dismiss(animated: true)
            parent.isPresented = false
            parent.onCancel()
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            controller.dismiss(animated: true)
            parent.isPresented = false
            parent.onError(error)
        }
    }
}
