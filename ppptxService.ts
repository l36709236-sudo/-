
import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

type SlideText = {
    path: string;
    texts: string[];
};

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    preserveOrder: true,
});

const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: false,
    preserveOrder: true,
    suppressEmptyNode: true,
});

// Recursively find all text nodes (<a:t>) in the parsed XML object
const findTextNodes = (node: any, texts: string[] = []) => {
    if (node['a:t']) {
        node['a:t'].forEach((tNode: any) => {
            if (tNode['#text'] && String(tNode['#text']).trim() !== "") {
                texts.push(tNode['#text']);
            }
        });
    }

    for (const key in node) {
        if (typeof node[key] === 'object' && node[key] !== null) {
            if(Array.isArray(node[key])) {
                node[key].forEach((item: any) => findTextNodes(item, texts));
            }
        }
    }
    return texts;
};


export const extractTextsFromPptx = async (file: File): Promise<SlideText[]> => {
    const zip = await JSZip.loadAsync(file);
    const slidePromises: Promise<SlideText | null>[] = [];
    
    zip.folder('ppt/slides')?.forEach((relativePath, zipEntry) => {
        if (zipEntry.name.endsWith('.xml')) {
            const promise = zipEntry.async('string').then(content => {
                try {
                    const parsedXml = parser.parse(content);
                    const texts = findTextNodes(parsedXml);
                    if (texts.length > 0) {
                        return { path: zipEntry.name, texts };
                    }
                    return null;
                } catch (e) {
                    console.error(`Error parsing ${zipEntry.name}:`, e);
                    return null;
                }
            });
            slidePromises.push(promise);
        }
    });

    const slides = await Promise.all(slidePromises);
    return slides.filter((slide): slide is SlideText => slide !== null);
};

// Recursively replace text nodes
const replaceTextNodes = (node: any, texts: string[], counter: { index: number }) => {
    if (node['a:t']) {
        node['a:t'].forEach((tNode: any) => {
            if (tNode['#text'] && String(tNode['#text']).trim() !== "") {
                if (counter.index < texts.length) {
                    tNode['#text'] = texts[counter.index];
                    counter.index++;
                }
            }
        });
    }
    
    for (const key in node) {
        if (typeof node[key] === 'object' && node[key] !== null) {
            if(Array.isArray(node[key])) {
                node[key].forEach((item: any) => replaceTextNodes(item, texts, counter));
            }
        }
    }
};

export const rebuildPptxWithTranslatedTexts = async (
    file: File,
    translatedSlides: SlideText[]
): Promise<Blob> => {
    const zip = await JSZip.loadAsync(file);

    for (const slide of translatedSlides) {
        const slideFile = zip.file(slide.path);
        if (slideFile) {
            const content = await slideFile.async('string');
            try {
                const parsedXml = parser.parse(content);
                replaceTextNodes(parsedXml, slide.texts, { index: 0 });
                const newXmlContent = builder.build(parsedXml);
                zip.file(slide.path, newXmlContent);
            } catch (e) {
                console.error(`Error rebuilding ${slide.path}:`, e);
                // Continue to next slide
            }
        }
    }

    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
};
