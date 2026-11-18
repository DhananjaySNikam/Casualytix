TEX=main
PDF=$(TEX).pdf

all: pdf

pdf:
	latexmk -pdf -pdflatex="pdflatex -interaction=nonstopmode" $(TEX).tex

manual:
	pdflatex $(TEX).tex
	bibtex $(TEX)
	pdflatex $(TEX).tex
	pdflatex $(TEX).tex

clean:
	latexmk -C
	rm -f $(TEX).bbl $(TEX).blg $(TEX).aux $(TEX).toc $(TEX).lof $(TEX).lot $(TEX).out $(TEX).log $(TEX).fls $(TEX).fdb_latexmk

view: pdf
	xdg-open $(PDF) 2>/dev/null || open $(PDF) 2>/dev/null || echo "Open $(PDF) manually"

# Convert SVG atlas to PDF (requires inkscape)
svg2pdf:
	for f in images/*.svg; do \
	  echo "Converting $$f -> $${f%.svg}.pdf"; \
	  inkscape "$$f" --export-filename="$${f%.svg}.pdf" 2>/dev/null || echo "Inkscape not found for $$f"; \
	done

.PHONY: all pdf manual clean view svg2pdf
